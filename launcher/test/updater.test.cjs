const assert=require('assert'), crypto=require('crypto'), fs=require('fs'), os=require('os'), path=require('path');
const U=require(process.env.UPDATER_CJS);
const manifest={version:"1.0",baseUrl:"https://cdn.example/game/",files:[
  {path:"a.pak",size:10,sha256:"aa"},{path:"b.pak",size:20,sha256:"bb"},{path:"c.pak",size:30,sha256:"cc"}]};
const plan=U.diffManifest({"a.pak":{size:10,sha256:"AA"},"b.pak":{size:20,sha256:"zz"}},manifest);
assert.strictEqual(plan.upToDate,1); assert.deepStrictEqual(plan.toDownload.map(f=>f.path),["b.pak","c.pak"]);
assert.strictEqual(plan.bytesToDownload,50); assert.strictEqual(plan.bytesTotal,60);
console.log("diffManifest OK");
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"upd-"));
  const content=Buffer.from("HELLO-CLASSIC5RP-GAME-FILE");
  const sha=crypto.createHash('sha256').update(content).digest('hex');
  const man={version:"1",baseUrl:"https://cdn/",files:[{path:"data/x.bin",size:content.length,sha256:sha}]};
  fs.mkdirSync(path.join(dir,"data"),{recursive:true});
  fs.writeFileSync(path.join(dir,"data","x.bin.part"),content.subarray(0,10));
  let rangeSeen=null;
  global.fetch=async(url,opts)=>{rangeSeen=opts&&opts.headers&&opts.headers.Range||null;
    const start=rangeSeen?parseInt(rangeSeen.match(/bytes=(\d+)-/)[1],10):0;const body=content.subarray(start);let s=false;
    return {ok:true,status:start?206:200,body:{getReader(){return{async read(){if(s)return{done:true};s=true;return{done:false,value:new Uint8Array(body)}}}}}};};
  await U.runUpdate(dir,man,U.diffManifest({},man),()=>{});
  assert.strictEqual(rangeSeen,"bytes=10-"); 
  assert.strictEqual(fs.readFileSync(path.join(dir,"data","x.bin")).toString(),content.toString());
  assert.ok(!fs.existsSync(path.join(dir,"data","x.bin.part")));
  console.log("runUpdate (resume+verify) OK");
  const bad={version:"1",baseUrl:"https://cdn/",files:[{path:"y.bin",size:4,sha256:"deadbeef"}]};
  global.fetch=async()=>({ok:true,status:200,body:{getReader(){let s=false;return{async read(){if(s)return{done:true};s=true;return{done:false,value:new Uint8Array(Buffer.from("abcd"))}}}}}});
  let threw=false; try{await U.runUpdate(dir,bad,U.diffManifest({},bad),()=>{});}catch(e){threw=/checksum/.test(e.message);}
  assert.ok(threw,"checksum mismatch rejected"); console.log("checksum verification OK");
  fs.rmSync(dir,{recursive:true,force:true}); console.log("ALL TESTS PASSED");
})().catch(e=>{console.error("TEST FAIL",e);process.exit(1)});
