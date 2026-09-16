const produk = [
  ["Canon EOS M50 Mark II + lensa kit","Rp 4.750.000","Bekas — mulus","Cirebon · 2 jam lalu"],
  ["Sepeda lipat Element Troy 11 speed","Rp 2.150.000","Seperti baru","Kuningan · 5 jam lalu"],
  ["MacBook Air M1 8/256 — cycle 84","Rp 8.900.000","Bekas — mulus","Bandung · kemarin"],
  ["Meja kerja kayu jati 120×60","Rp 750.000","Bekas — wajar","Cirebon · kemarin"],
  ["iPhone 12 128GB batre 87%","Rp 4.300.000","Bekas — mulus","Indramayu · 2 hari lalu"],
  ["Gitar akustik Yamaha F310","Rp 890.000","Bekas — wajar","Cirebon · 2 hari lalu"],
  ["Kulkas 2 pintu Sharp 180L","Rp 1.450.000","Bekas — wajar","Majalengka · 3 hari lalu"],
  ["Nintendo Switch OLED + 3 kaset","Rp 3.600.000","Seperti baru","Cirebon · 3 hari lalu"],
  ["Rak buku besi 5 tingkat","Rp 320.000","Bekas — wajar","Kuningan · 4 hari lalu"],
  ["Lensa Fujinon 35mm f/2 WR","Rp 3.100.000","Bekas — mulus","Bandung · 4 hari lalu"],
  ["Mesin cuci LG 7kg front loading","Rp 1.900.000","Bekas — wajar","Cirebon · 5 hari lalu"],
  ["Helm Shoei Z-8 size M","Rp 4.100.000","Seperti baru","Indramayu · 6 hari lalu"]
];
document.getElementById("grid").innerHTML = produk.map(([n,h,k,m],i)=>`
  <article class="pcard">
    <div class="thumb"><span class="cond">${k}</span>foto ${i+1}</div>
    <div class="body">
      <div class="pname">${n}</div>
      <div class="price">${h}</div>
      <div class="meta">${m}</div>
    </div>
  </article>`).join("");

const tabs = document.querySelectorAll(".proto-tabs button");
tabs.forEach(t=>t.addEventListener("click",()=>{
  tabs.forEach(x=>x.setAttribute("aria-selected", x===t ? "true":"false"));
  document.querySelectorAll("section.screen").forEach(s=>s.classList.toggle("on", s.id===t.dataset.go));
  window.scrollTo({top:0});
}));

document.querySelectorAll(".cats button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".cats button").forEach(x=>x.setAttribute("aria-pressed","false"));
  b.setAttribute("aria-pressed","true");
}));

document.querySelectorAll(".opt").forEach(o=>o.addEventListener("click",()=>{
  const r=o.querySelector("input"); if(!r) return;
  document.querySelectorAll(`.opt input[name="${r.name}"]`).forEach(x=>x.closest(".opt").dataset.sel="0");
  r.checked=true; o.dataset.sel="1";
}));

document.querySelectorAll(".room").forEach(r=>r.addEventListener("click",()=>{
  document.querySelectorAll(".room").forEach(x=>x.dataset.sel="0");
  r.dataset.sel="1";
}));
