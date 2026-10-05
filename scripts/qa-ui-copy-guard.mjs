import fs from "node:fs";
import path from "node:path";

const root=path.resolve("public/quality");
const failures=[];

function walk(dir){
  for(const name of fs.readdirSync(dir)){
    const file=path.join(dir,name);
    const stat=fs.statSync(file);
    if(stat.isDirectory()){walk(file);continue}
    if(!/\.(html|js|css)$/i.test(name))continue;
    const src=fs.readFileSync(file,"utf8");
    if(/\bTelegram\b|\bbot\b|https?:\/\/t\.me\//i.test(src)){
      failures.push(path.relative(process.cwd(),file));
    }
  }
}

walk(root);

if(failures.length){
  console.error("Forbidden QA UI wording found in:");
  for(const file of failures) console.error(" - "+file);
  process.exit(1);
}

console.log("QA UI wording guard PASS");
