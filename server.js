import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 3000);
const version = process.env.HAVEN_VERSION || '0.4.1';
const publicDir = process.env.PUBLIC_DIR || '/app/public';
const dataDir = process.env.DATA_DIR || '/app/data';
const settingsFile = join(dataDir,'settings.json');
const setupToken = process.env.HAVEN_SETUP_TOKEN || '';
const authBypass = String(process.env.HAVEN_AUTH_BYPASS).toLowerCase()==='true';
const baseAuth = {enabled:String(process.env.KEYCLOAK_ENABLED).toLowerCase()==='true',url:(process.env.KEYCLOAK_URL||'').replace(/\/$/,''),realm:process.env.KEYCLOAK_REALM||'',clientId:process.env.KEYCLOAK_CLIENT_ID||'haven'};
const emptyIntegrations = {homeAssistant:{url:(process.env.HOME_ASSISTANT_URL||'').replace(/\/$/,''),token:process.env.HOME_ASSISTANT_TOKEN||''},plex:{url:'',token:''},calendar:{icsUrl:''},arrs:{sonarr:{url:'',apiKey:''},radarr:{url:'',apiKey:''},lidarr:{url:'',apiKey:''},readarr:{url:'',apiKey:''}}};
let storedSettings = {};
await mkdir(dataDir,{recursive:true});
try{storedSettings=JSON.parse(await readFile(settingsFile,'utf8'))}catch{}
let runtimeAuth = {...baseAuth,...(storedSettings.auth||{})};
let integrationOwnerSub = String(storedSettings.integrationOwnerSub||'');
let integrations = {homeAssistant:{...emptyIntegrations.homeAssistant,...(storedSettings.integrations?.homeAssistant||{})},plex:{...emptyIntegrations.plex,...(storedSettings.integrations?.plex||{})},calendar:{...emptyIntegrations.calendar,...(storedSettings.integrations?.calendar||{})},arrs:{}};
for(const name of Object.keys(emptyIntegrations.arrs))integrations.arrs[name]={...emptyIntegrations.arrs[name],...(storedSettings.integrations?.arrs?.[name]||{})};
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const clientConfig = {user:{name:process.env.HAVEN_USER_NAME||'Mike'},auth:{}};

async function persistSettings(){storedSettings={...storedSettings,auth:runtimeAuth,integrations,integrationOwnerSub};await writeFile(settingsFile,JSON.stringify(storedSettings,null,2),'utf8')}
async function writeClientConfig(){clientConfig.auth={...runtimeAuth,enabled:runtimeAuth.enabled&&!authBypass,adapterUrl:'/vendor/keycloak.js'};await writeFile(join(publicDir,'config.js'),`export default ${JSON.stringify(clientConfig)};\n`,'utf8')}
await writeClientConfig();

function securityHeaders(){
  let keycloakOrigin='';
  try{keycloakOrigin=runtimeAuth.url?new URL(runtimeAuth.url).origin:''}catch{}
  return {'X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https: ${keycloakOrigin}; img-src 'self' data: blob: http: https:; frame-ancestors 'self'`};
}
function send(res,status,body,type='application/json'){res.writeHead(status,{...securityHeaders(),'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'&&typeof body!=='string'?JSON.stringify(body):body)}
async function readJson(req){let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)throw new Error('Request too large')}return JSON.parse(body||'{}')}
function setupAuthorized(req,res){if(!setupToken){send(res,503,{error:'HAVEN_SETUP_TOKEN is not configured in Portainer'});return false}if(req.headers['x-haven-setup-token']!==setupToken){send(res,403,{error:'Invalid setup token'});return false}return true}
function cleanUrl(value){const text=String(value||'').trim().replace(/\/$/,'');if(!text)return '';const parsed=new URL(text);if(!['http:','https:'].includes(parsed.protocol))throw new Error('Only http and https URLs are allowed');return text}

async function authenticatedIdentity(req){
  if(!runtimeAuth.enabled||!runtimeAuth.url||!runtimeAuth.realm)return false;
  const authorization=req.headers.authorization;
  if(!authorization?.startsWith('Bearer '))return false;
  try{const response=await fetch(`${runtimeAuth.url}/realms/${encodeURIComponent(runtimeAuth.realm)}/protocol/openid-connect/userinfo`,{headers:{Authorization:authorization},signal:AbortSignal.timeout(5000)});return response.ok?await response.json():false}catch{return false}
}
async function authenticated(req){return Boolean(await authenticatedIdentity(req))}
async function requireAuth(req,res){if(await authenticated(req))return true;send(res,401,{error:'Keycloak authentication required'});return false}
async function integrationOwnerAuthorized(req,res){const identity=await authenticatedIdentity(req);if(identity?.sub&&(!integrationOwnerSub||integrationOwnerSub===identity.sub)){if(!integrationOwnerSub){integrationOwnerSub=identity.sub;await persistSettings()}return true}return setupAuthorized(req,res)}

async function configureKeycloak(req,res){
  if(!setupAuthorized(req,res))return;
  try{const body=await readJson(req),url=cleanUrl(body.url),realm=String(body.realm||'').trim(),clientId=String(body.clientId||'').trim();if(body.enabled&&(!url||!realm||!clientId))return send(res,400,{error:'URL, realm, and client ID are required'});runtimeAuth={enabled:Boolean(body.enabled),url,realm,clientId:clientId||'haven'};await persistSettings();await writeClientConfig();return send(res,200,{ok:true})}catch(error){return send(res,400,{error:error.message||'Invalid settings'})}
}
function mergeSecretService(input,previous,secretKey){const url=cleanUrl(input?.url);if(!url)return {url:'',[secretKey]:''};return {url,[secretKey]:String(input?.[secretKey]||'').trim()||previous?.[secretKey]||''}}
async function configureIntegrations(req,res){
  if(!await integrationOwnerAuthorized(req,res))return;
  try{
    const body=await readJson(req),next={homeAssistant:mergeSecretService(body.homeAssistant,integrations.homeAssistant,'token'),plex:mergeSecretService(body.plex,integrations.plex,'token'),calendar:{icsUrl:String(body.calendar?.icsUrl||'').trim()?cleanUrl(body.calendar.icsUrl):integrations.calendar.icsUrl},arrs:{}};
    for(const name of Object.keys(emptyIntegrations.arrs))next.arrs[name]=mergeSecretService(body.arrs?.[name],integrations.arrs[name],'apiKey');
    integrations=next;await persistSettings();return send(res,200,{ok:true});
  }catch(error){return send(res,400,{error:error.message||'Invalid integration settings'})}
}

const weatherDescriptions={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Rain showers',82:'Heavy showers',95:'Thunderstorms',96:'Thunderstorms',99:'Severe thunderstorms'};
async function weather(res,url){
  const location=String(url.searchParams.get('location')||'').trim();if(!location)return send(res,400,{error:'Weather location is required'});
  try{
    const geoUrl=new URL('https://geocoding-api.open-meteo.com/v1/search');geoUrl.search=new URLSearchParams({name:location,count:'1',language:'en',format:'json'});
    const geo=await (await fetch(geoUrl,{signal:AbortSignal.timeout(8000)})).json(),place=geo.results?.[0];if(!place)return send(res,404,{error:'Location not found'});
    const forecastUrl=new URL('https://api.open-meteo.com/v1/forecast');forecastUrl.search=new URLSearchParams({latitude:String(place.latitude),longitude:String(place.longitude),current:'temperature_2m,relative_humidity_2m,weather_code,is_day',hourly:'temperature_2m,weather_code',temperature_unit:'fahrenheit',forecast_days:'2',timezone:'auto'});
    const data=await (await fetch(forecastUrl,{signal:AbortSignal.timeout(8000)})).json();
    const start=Math.max(0,data.hourly.time.findIndex(time=>time>=data.current.time));const hourly=data.hourly.time.slice(start,start+5).map((time,index)=>({time,temperature:Math.round(data.hourly.temperature_2m[start+index]),code:data.hourly.weather_code[start+index]}));
    return send(res,200,{location:[place.name,place.admin1].filter(Boolean).join(', '),temperature:Math.round(data.current.temperature_2m),humidity:Math.round(data.current.relative_humidity_2m),code:data.current.weather_code,condition:weatherDescriptions[data.current.weather_code]||'Current conditions',isDay:Boolean(data.current.is_day),hourly});
  }catch{return send(res,502,{error:'Weather service could not be reached'})}
}

function xmlDecode(value=''){return value.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>')}
function xmlAttributes(text){const result={};for(const match of text.matchAll(/([\w:]+)="([^"]*)"/g))result[match[1]]=xmlDecode(match[2]);return result}
async function plexRecent(req,res){
  if(!await requireAuth(req,res))return;if(!integrations.plex.url||!integrations.plex.token)return send(res,503,{error:'Plex is not configured'});
  try{const response=await fetch(`${integrations.plex.url}/library/recentlyAdded?X-Plex-Token=${encodeURIComponent(integrations.plex.token)}`,{headers:{Accept:'application/xml'},signal:AbortSignal.timeout(10000)});if(!response.ok)return send(res,502,{error:`Plex returned ${response.status}`});const xml=await response.text(),items=[];for(const match of xml.matchAll(/<(Video|Directory)\b([^>]*)>/g)){const item=xmlAttributes(match[2]);if(!item.title)continue;items.push({title:item.title,year:item.year||'',type:item.type||match[1].toLowerCase(),addedAt:Number(item.addedAt||0),thumb:item.thumb?`/api/plex/image?path=${encodeURIComponent(item.thumb)}`:''});if(items.length===12)break}return send(res,200,{items})}catch{return send(res,502,{error:'Plex could not be reached'})}
}
async function plexImage(req,res,url){
  if(!await requireAuth(req,res))return;if(!integrations.plex.url||!integrations.plex.token)return send(res,503,{error:'Plex is not configured'});const path=String(url.searchParams.get('path')||'');if(!path.startsWith('/'))return send(res,400,{error:'Invalid image path'});
  try{const upstream=await fetch(`${integrations.plex.url}${path}${path.includes('?')?'&':'?'}X-Plex-Token=${encodeURIComponent(integrations.plex.token)}`,{signal:AbortSignal.timeout(10000)});const body=Buffer.from(await upstream.arrayBuffer());res.writeHead(upstream.status,{...securityHeaders(),'Content-Type':upstream.headers.get('content-type')||'image/jpeg','Cache-Control':'private, max-age=3600'});res.end(body)}catch{return send(res,502,{error:'Plex image unavailable'})}
}

function parseIcsDate(value){const text=String(value||'').replace(/^.*:/,'');const match=text.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);if(!match)return null;const parts=match.slice(1,7).map(Number);return match[7]?new Date(Date.UTC(parts[0],parts[1]-1,parts[2],parts[3]||0,parts[4]||0,parts[5]||0)):new Date(parts[0],parts[1]-1,parts[2],parts[3]||0,parts[4]||0,parts[5]||0)}
function parseCalendar(text){const unfolded=text.replace(/\r?\n[ \t]/g,''),now=Date.now()-86400000,events=[];for(const block of unfolded.split('BEGIN:VEVENT').slice(1)){const body=block.split('END:VEVENT')[0],lines=body.split(/\r?\n/),summary=lines.find(line=>line.startsWith('SUMMARY'))?.replace(/^SUMMARY[^:]*:/,'').replace(/\\,/g,',').replace(/\\n/g,' ')||'Untitled event',start=parseIcsDate(lines.find(line=>line.startsWith('DTSTART'))),end=parseIcsDate(lines.find(line=>line.startsWith('DTEND')))||start;if(start&&end?.getTime()>=now)events.push({summary,start:start.toISOString(),end:end.toISOString(),allDay:!lines.find(line=>line.startsWith('DTSTART'))?.includes('T')})}return events.sort((a,b)=>a.start.localeCompare(b.start)).slice(0,20)}
async function calendarEvents(req,res){if(!await requireAuth(req,res))return;if(!integrations.calendar.icsUrl)return send(res,503,{error:'Calendar is not configured'});try{const response=await fetch(integrations.calendar.icsUrl,{signal:AbortSignal.timeout(10000)});if(!response.ok)return send(res,502,{error:`Calendar returned ${response.status}`});return send(res,200,{events:parseCalendar(await response.text())})}catch{return send(res,502,{error:'Calendar could not be reached'})}}

async function testIntegration(req,res,url){
  if(!await requireAuth(req,res))return;const service=String(url.searchParams.get('service')||'');
  try{let target,headers={};if(service==='homeAssistant'){const config=integrations.homeAssistant;if(!config.url||!config.token)throw new Error('Home Assistant is not configured');target=`${config.url}/api/`;headers.Authorization=`Bearer ${config.token}`}else if(service==='plex'){if(!integrations.plex.url||!integrations.plex.token)throw new Error('Plex is not configured');target=`${integrations.plex.url}/identity`;headers['X-Plex-Token']=integrations.plex.token}else if(service==='calendar'){if(!integrations.calendar.icsUrl)throw new Error('Calendar is not configured');target=integrations.calendar.icsUrl}else if(integrations.arrs[service]){const config=integrations.arrs[service];if(!config.url||!config.apiKey)throw new Error(`${service} is not configured`);target=`${config.url}/api/v3/system/status`;headers['X-Api-Key']=config.apiKey}else throw new Error('Unknown integration');const response=await fetch(target,{headers,signal:AbortSignal.timeout(8000)});return send(res,response.ok?200:502,{ok:response.ok,status:response.status})}catch(error){return send(res,502,{error:error.message||'Connection failed'})}
}

async function homeAssistant(req,res,url){if(!await requireAuth(req,res))return;const config=integrations.homeAssistant;if(!config.url||!config.token)return send(res,503,{error:'Home Assistant is not configured on the server'});const suffix=url.pathname.replace('/api/home-assistant','')||'/api/';if(!suffix.startsWith('/api/'))return send(res,400,{error:'Only Home Assistant API paths are allowed'});try{const upstream=await fetch(`${config.url}${suffix}${url.search}`,{method:req.method,headers:{Authorization:`Bearer ${config.token}`,'Content-Type':req.headers['content-type']||'application/json'},signal:AbortSignal.timeout(10000)});const body=Buffer.from(await upstream.arrayBuffer());res.writeHead(upstream.status,{...securityHeaders(),'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store'});res.end(body)}catch{return send(res,502,{error:'Home Assistant could not be reached'})}}

function integrationStatus(includePrivate=false){const arrs={};for(const [name,config] of Object.entries(integrations.arrs))arrs[name]={configured:Boolean(config.url&&config.apiKey),...(includePrivate?{url:config.url}:{})};return {version,homeAssistant:{configured:Boolean(integrations.homeAssistant.url&&integrations.homeAssistant.token),...(includePrivate?{url:integrations.homeAssistant.url}:{})},keycloak:{configured:Boolean(runtimeAuth.enabled&&runtimeAuth.url&&runtimeAuth.realm),url:runtimeAuth.url,realm:runtimeAuth.realm,clientId:runtimeAuth.clientId,enabled:runtimeAuth.enabled,bypassed:authBypass},plex:{configured:Boolean(integrations.plex.url&&integrations.plex.token),...(includePrivate?{url:integrations.plex.url}:{})},calendar:{configured:Boolean(integrations.calendar.icsUrl)},arrs,setup:{available:Boolean(setupToken)}}}
async function staticFile(req,res,url){const requestPath=url.pathname==='/'?'/index.html':url.pathname,safePath=normalize(requestPath).replace(/^(\.\.[/\\])+/,'');let filePath=join(publicDir,safePath);if(!filePath.startsWith(publicDir))return send(res,403,'Forbidden','text/plain');try{if(!(await stat(filePath)).isFile())throw new Error()}catch{filePath=join(publicDir,'index.html')}try{const body=await readFile(filePath),cache=filePath.endsWith('config.js')?'no-store':filePath.endsWith('app.js')||filePath.endsWith('service-worker.js')?'no-cache':'public, max-age=3600';res.writeHead(200,{...securityHeaders(),'Content-Type':mime[extname(filePath)]||'application/octet-stream','Cache-Control':cache});res.end(body)}catch{return send(res,404,'Not found','text/plain')}}

createServer(async(req,res)=>{const url=new URL(req.url,'http://haven');if(url.pathname==='/health')return send(res,200,'healthy\n','text/plain');if(url.pathname==='/api/integrations')return send(res,200,integrationStatus(await authenticated(req)));if(url.pathname==='/api/setup/keycloak'&&req.method==='POST')return configureKeycloak(req,res);if(url.pathname==='/api/setup/integrations'&&req.method==='POST')return configureIntegrations(req,res);if(url.pathname==='/api/weather')return weather(res,url);if(url.pathname==='/api/plex/recent')return plexRecent(req,res);if(url.pathname==='/api/plex/image')return plexImage(req,res,url);if(url.pathname==='/api/calendar/events')return calendarEvents(req,res);if(url.pathname==='/api/integrations/test')return testIntegration(req,res,url);if(url.pathname.startsWith('/api/home-assistant'))return homeAssistant(req,res,url);return staticFile(req,res,url)}).listen(port,'0.0.0.0',()=>console.log(`Haven listening on ${port}`));
