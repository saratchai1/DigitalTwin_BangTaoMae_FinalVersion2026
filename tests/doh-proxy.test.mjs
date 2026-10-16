import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { rootCertificates } from 'node:tls';
import { allowedUrl, rewritePlaylist, MASTER, handler, CAMERA } from '../netlify/functions/doh-hls-proxy.mjs';
import { dohIntermediate } from '../netlify/lib/doh-certificate.mjs';
test('verified camera and public CA',()=>{
 assert.equal(CAMERA.kilometer,'956+105'); assert.equal(CAMERA.controlSection,'1101');
 const cert=new X509Certificate(dohIntermediate);
 assert.equal(cert.fingerprint256.replaceAll(':',''),'8C54C334B66BA4E426772AF4A3F9136C19A1AEC729FDB28C535C07A5A4EF22E0');
 assert.ok(rootCertificates.some(root=>{const r=new X509Certificate(root);return cert.issuer===r.subject && cert.verify(r.publicKey);}));
});
test('restricts origin, camera, scheme, path and credentials',()=>{
 assert.ok(allowedUrl(MASTER));
 for(const u of ['http://localhost/x.m3u8','https://evil.test/a.ts',MASTER.replace('PER-14','Phase14'),MASTER.replace('PER_14_007','PER_14_008'),MASTER.replace('https://','https://user:password@'),MASTER.replace('playlist.m3u8','%2f..%2fkey.ts')]) assert.equal(allowedUrl(u),false,u);
});
test('rewrites session playlists, segments and URI attributes',()=>{
 const text='#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-KEY:METHOD=AES-128,URI="video.key"\nchunklist_wNEW.m3u8\nmedia_17.ts';
 const out=rewritePlaylist(text,MASTER);
 assert.equal((out.match(/doh-hls-proxy\?url=/g)||[]).length,4);
 assert.throws(()=>rewritePlaylist('#EXTM3U\nhttps://evil.test/a.ts',MASTER));
 assert.throws(()=>rewritePlaylist('<html>offline</html>',MASTER));
});
test('bad input is rejected before fetching',async()=>{
 assert.equal((await handler({httpMethod:'GET',queryStringParameters:{url:'http://127.0.0.1/'}})).statusCode,400);
 assert.equal((await handler({httpMethod:'POST'})).statusCode,405);
 assert.equal((await handler({httpMethod:'OPTIONS'})).statusCode,204);
 assert.equal((await handler({httpMethod:'GET',headers:{range:'bytes=0-1,2-3'}})).statusCode,400);
});
