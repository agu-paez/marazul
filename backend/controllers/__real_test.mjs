import fs from "fs";
import { PassThrough } from "stream";
import { generarPDFMarcasProductos } from "./marcaController.js";

const file = "C:/Users/PAEZ/AppData/Local/Temp/opencode/real-marcas.pdf";
const out = fs.createWriteStream(file);

const res = new PassThrough();
res.pipe(out);
res.setHeader = () => {};
res.setHeader("Content-Type", "application/pdf");

res.on("finish", () => {
  console.log("finish", fs.statSync(file).size);
});
res.on("error", (e) => console.error("res error", e.message));

await generarPDFMarcasProductos({}, res).catch((e) => {
  console.error("controller error:", e.message);
  process.exit(1);
});
console.log("controller returned");
setTimeout(() => {
  console.log("size:", fs.statSync(file).size);
  process.exit(0);
}, 500);
