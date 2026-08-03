import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 3000);
const publicDir = process.env.PUBLIC_DIR || '/app/public';
const keycloakUrl = (process.env.KEYCLOAK_URL || '').replace(/\/$/, '');
const keycloakRealm = process.env.KEYCLOAK_REALM || '';
const homeAssistantUrl = (process.env.HOME_ASSISTANT_URL || '').replace(/\/$/, '');
const homeAssistantToken = process.env.HOME_ASSISTANT_TOKEN || '';
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};

const clientConfig = {
  user:{name:process.env.HAVEN_USER_NAME||'Mike'},
  auth:{
    enabled:String(process.env.KEYCLOAK_ENABLED).toLowerCase()==='true',
    url:keycloakUrl||'https://auth.example.com',
    realm:keycloakRealm||'home',
    clientId:process.env.KEYCLOAK_CLIENT_ID||'haven',
    adapterUrl:'https://cdn.jsdelivr.net/npm/keycloak-js/+esm'
  }
};
await writeFile(join(publicDir,'config.js'),`export default ${JSON.stringify(clientConfig)};\n`,'utf8');

const securityHeaders = {
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'SAMEORIGIN',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https:; img-src 'self' data:; frame-ancestors 'self'"
};

function send(res,status,body,type='application/json'){
  res.writeHead(status,{...securityHeaders,'Content-Type':type,'Cache-Control':'no-store'});
  res.end(type==='application/json'&&typeof body!=='string'?JSON.stringify(body):body);
}

async function authenticated(req){
  if(!keycloakUrl||!keycloakRealm)return false;
  const authorization=req.headers.authorization;
  if(!authorization?.startsWith('Bearer '))return false;
  try{
    const response=await fetch(`${keycloakUrl}/realms/${encodeURIComponent(keycloakRealm)}/protocol/openid-connect/userinfo`,{headers:{Authorization:authorization},signal:AbortSignal.timeout(5000)});
    return response.ok;
  }catch{return false}
}

async function homeAssistant(req,res,url){
  if(!await authenticated(req))return send(res,401,{error:'Keycloak authentication required'});
  if(!homeAssistantUrl||!homeAssistantToken)return send(res,503,{error:'Home Assistant is not configured on the server'});
  const suffix=url.pathname.replace('/api/home-assistant','')||'/api/';
  if(!suffix.startsWith('/api/'))return send(res,400,{error:'Only Home Assistant API paths are allowed'});
  try{
    const upstream=await fetch(`${homeAssistantUrl}${suffix}${url.search}`,{method:req.method,headers:{Authorization:`Bearer ${homeAssistantToken}`,'Content-Type':req.headers['content-type']||'application/json'},signal:AbortSignal.timeout(10000)});
    const body=Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status,{...securityHeaders,'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store'});res.end(body);
  }catch{return send(res,502,{error:'Home Assistant could not be reached'})}
}

async function staticFile(req,res,url){
  const requestPath=url.pathname==='/'?'/index.html':url.pathname;
  const safePath=normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  let filePath=join(publicDir,safePath);
  if(!filePath.startsWith(publicDir))return send(res,403,'Forbidden','text/plain');
  try{if(!(await stat(filePath)).isFile())throw new Error();}
  catch{filePath=join(publicDir,'index.html')}
  try{const body=await readFile(filePath);const cache=filePath.endsWith('config.js')?'no-store':filePath.endsWith('service-worker.js')?'no-cache':'public, max-age=3600';res.writeHead(200,{...securityHeaders,'Content-Type':mime[extname(filePath)]||'application/octet-stream','Cache-Control':cache});res.end(body)}
  catch{return send(res,404,'Not found','text/plain')}
}

createServer(async(req,res)=>{
  const url=new URL(req.url,'http://haven');
  if(url.pathname==='/health')return send(res,200,'healthy\n','text/plain');
  if(url.pathname==='/api/integrations')return send(res,200,{homeAssistant:{configured:Boolean(homeAssistantUrl&&homeAssistantToken)},keycloak:{configured:Boolean(keycloakUrl&&keycloakRealm)}});
  if(url.pathname.startsWith('/api/home-assistant'))return homeAssistant(req,res,url);
  return staticFile(req,res,url);
}).listen(port,'0.0.0.0',()=>console.log(`Haven listening on ${port}`));
