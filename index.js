const C={A:'0xD9157453E2668B2fc45b7A803D3FEF3642430cC0',B:[{inputs:[{name:"_queryId",type:"bytes32"},{name:"_value",type:"bytes"},{name:"_nonce",type:"uint256"},{name:"_queryData",type:"bytes"}],name:"submitValue"},{inputs:[{name:"_queryId",type:"bytes32"}],name:"getNewValueCountbyQueryId",outputs:[{type:"uint256"}]}],u:'api.scan.pulsechain.com/api/v2/addresses/',b:100,m:10,r:3,t:3e5,k:'i',c:'0x434F4D4D454E54'},P=function(){this.d=new Map;this.t=new Map};P.prototype={g:function(k){const v=this.d.get(k);if(v)this.t.set(k,Date.now());return v},s:function(k,v){const n=Date.now();this.t.forEach(function(t,k){if(n-t>C.t){this.d.delete(k);this.t.delete(k)}}.bind(this));this.d.set(k,v);this.t.set(k,n)}};function A(){this.e=window.ethers;this.h=new P;this.s={i:[],l:0,n:0,p:null,r:new Set,t:0};this._=document.getElementById.bind(document);this.setup()}A.prototype={setup:function(){const s=this;document.body.insertAdjacentHTML('beforeend','<div id=m><div id=n><button class=x>×</button><div id=r></div><div id=s><div id=l></div><div class=i><textarea id=t></textarea><button id=cs>💬</button></div></div></div><div id=o></div>');document.head.appendChild(Object.assign(document.createElement('style'),{textContent:'#m{display:none;position:fixed;inset:0;background:#0008;z-index:9}#n{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:90%;max-width:600px;background:#13101c;border-radius:12px;padding:20px;max-height:90vh;display:flex;flex-direction:column}.x{position:absolute;right:12px;top:12px;background:0;border:0;color:#fff;font-size:24px;cursor:pointer}#s{flex:1;display:flex;flex-direction:column;min-height:0}#l{flex:1;overflow-y:auto;margin:0 -12px 20px;padding:0 12px}.i{border-top:1px solid#2a2438;padding:20px 0}#t{width:100%;height:80px;background:#1a1327;border:1px solid#2a2438;border-radius:8px;padding:12px;color:#fff;margin:0 0 10px;resize:vertical}#cs{background:#7c4dff;color:#fff;border:0;padding:8px 16px;border-radius:4px;cursor:pointer}#cs:hover{background:#6c3aef}#cs:disabled{opacity:.5}.m{padding:15px;border-bottom:1px solid#2a2438}#o{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#2a2438;color:#fff;padding:12px 24px;border-radius:8px;z-index:9;display:none}'}));document.addEventListener('click',function(e){const t=e.target;if(!t)return;if(t.classList.contains('x')){s.hm();return}if(t.matches('.action-btn')){const p=t.closest('.report-actions');if(p){const d=p.dataset;if(t.dataset.action==='comment'){s.sm(d.queryId)}else if(t.dataset.action==='dispute'&&window.disputeNews){window.disputeNews(d.reporter,d.queryId,d.timestamp)}}return}if(t.id==='connectWallet')s.w();else if(t.id==='publishStory')s.ps();else if(t.id==='loadMoreButton')s.c();else if(t.id==='cs')s.pc()});const x=this._('t');if(x)new ResizeObserver(function(){window.requestAnimationFrame(function(){x.style.height=x.scrollHeight+'px'})}).observe(x);try{const d=localStorage.getItem(C.k);if(d)this.s.i=JSON.parse(d)}catch(e){}this.f();setInterval(function(){s.h.s();s.c()},C.t)},tx:async function(p){const k=p?JSON.stringify(p):'_';const v=this.h.g(k);if(v)return v;const u=`https://${C.u}${C.A}/transactions?filter=to&sort=desc&limit=${C.b}${p?'&'+new URLSearchParams(p):''}`;if(this.s.r.has(u))return new Promise(function(r){setTimeout(function(){r(this.tx(p))}.bind(this),100)}.bind(this));this.s.r.add(u);try{const r=await(await fetch(u)).json();this.h.s(k,r);return r}finally{this.s.r.delete(u)}},c:async function(){if(this.s.l||Date.now()-this.s.t<3e4)return;this.s.l=1;this.g(1);try{const r=await this.tx(),n=await this.p(r),u=[];for(const x of n)if(!this.s.i.some(function(y){return y.queryId===x.queryId}))u.push(x);if(u.length){this.s.i.unshift.apply(this.s.i,u);this.r(u,1);localStorage.setItem(C.k,JSON.stringify(this.s.i.slice(0,50)));this.t('+'+u.length)}this.s.t=Date.now()}catch(e){console.error(e)}finally{this.s.l=0;this.g(0)}},f:async function(x){if(this.s.l||this.s.n&&!x)return;this.s.l=1;this.g(1);if(x){this.s.i=[];this.s.n=0;this.s.p=null}try{const q=[],n=[];while(n.length<C.m&&!this.s.n){q.push(this.tx(this.s.p));if(q.length>=C.r){const b=await q.shift(),i=await this.p(b);Array.prototype.push.apply(n,i||[])}}while(q.length){const b=await q.shift(),i=await this.p(b);Array.prototype.push.apply(n,i||[])}if(n.length){this.s.i=x?n:this.s.i.concat(n);this.r(n,!x);localStorage.setItem(C.k,JSON.stringify(this.s.i.slice(0,50)))}this._('loadMoreButton').style.display=this.s.n?'none':'block'}catch(e){console.error(e)}finally{this.s.l=0;this.g(0)}},p:async function(b){if(!b?.items?.length){this.s.n=1;return[]}const i=[],self=this;for(const t of b.items){if(t.decoded_input?.parameters?.length>=4&&t.method==='submitValue')try{const[y,b]=this.e.utils.defaultAbiCoder.decode(['string','bytes'],t.decoded_input.parameters[3].value);if(y==='StringQuery'){const c=this.e.utils.toUtf8String(b).trim();if(c)i.push({content:c,reporter:t.from.hash||t.from,timestamp:t.timestamp||t.block_timestamp,queryId:t.decoded_input.parameters[0].value})}}catch(e){}}this.s.p=b.next_page_params||null;this.s.n=!this.s.p;return i},r:function(i,a){if(!i.length&&!a)return this._('newsFeed').innerHTML='No items';const f=document.createDocumentFragment(),t=document.createElement('template');const s=this;i.forEach(function(m){t.innerHTML=`<article class="news-item"><div class="reporter-info"><img src="newTRBphoto.jpg" alt="R" class="avatar"><div class="reporter-details"><span class="reporter-name">${s.sh(m.reporter)}</span>· ${s.dt(m.timestamp)}</div></div><div class="report-content">${m.content.split('\n\n').map(function(p){return'<p>'+p.replace(/\n/g,'<br>')+'</p>'}).join('')}</div><div class="report-actions"data-reporter="${m.reporter}"data-query-id="${m.queryId}"data-timestamp="${m.timestamp}"><button class="action-btn"data-action="comment">💬</button><button class="action-btn"data-action="like">👍</button><button class="action-btn"data-action="dispute">⚠️</button><button class="action-btn"data-action="vote">✓</button></div></article>`;f.appendChild(t.content.firstChild)});const n=this._('newsFeed');window.requestAnimationFrame(function(){if(!a)n.textContent='';n.appendChild(f);n.style.visibility='visible'})},gc:async function(i){const k=`c${i}`,v=this.h.g(k);if(v)return v;const r=await this.tx(),c=[];for(const t of r.items||[]){if(t.value==='0'&&t.input?.startsWith(C.c))try{const[q,x]=this.e.utils.defaultAbiCoder.decode(['bytes32','string'],'0x'+t.input.slice(C.c.length));if(q===i)c.push({text:x,author:t.from.hash||t.from,timestamp:t.timestamp||t.block_timestamp})}catch(e){}}this.h.s(k,c);return c},pc:async function(){const t=this._('t'),b=this._('cs');if(!t||!b)return;const v=t.value.trim();if(!v)return;b.disabled=1;try{if(!window.ethereum)throw'Install MetaMask';const p=new this.e.providers.Web3Provider(window.ethereum);const s=await p.send('eth_requestAccounts',[]).then(function(){return p.getSigner()});await(await s.sendTransaction({to:C.A,value:'0',data:C.c+this.e.utils.defaultAbiCoder.encode(['bytes32','string'],[this.cr.queryId,v]).slice(2)})).wait();t.value='';this.lc(this.cr.queryId);this.t('✓')}catch(e){this.t(e.message||'✗')}finally{b.disabled=0}},w:async function(){try{if(!window.ethereum)throw'Install MetaMask';const p=new this.e.providers.Web3Provider(window.ethereum);await p.send('eth_requestAccounts',[]);const s=p.getSigner(),a=await s.getAddress();this._('connectWallet').style.display='none';this._('walletInfo').style.display='block';this._('walletAddress').textContent=this.sh(a);this._('publishStory').disabled=0;this.w=new this.e.Contract(C.A,C.B,s)}catch(e){this.t(e.message||'Failed')}},sm:function(i){const r=this.s.i.find(function(x){return x.queryId===i});if(!r)return;this.cr=r;this._('r').innerHTML=`<div><div class="reporter-info"><img src="newTRBphoto.jpg"alt=R><div><span>${this.sh(r.reporter)}</span>· ${this.dt(r.timestamp)}</div></div><div>${r.content.split('\n\n').map(function(p){return'<p>'+p.replace(/\n/g,'<br>')+'</p>'}).join('')}</div></div>`;this.lc(i);this._('m').style.display='block';document.body.style.overflow='hidden'},lc:async function(i){const l=this._('l');if(!l)return;l.innerHTML='<div class="d">...</div>';try{const c=await this.gc(i);l.innerHTML=c.length?c.map(function(c){return`<div class="m">${this.sh(c.author)} · ${this.dt(c.timestamp)}<br>${c.text}</div>`}.bind(this)).join(''):'No comments'}catch{l.innerHTML='Failed'}},sh:function(a){return a?.length>10?a.slice(0,6)+'...'+a.slice(-4):a||'-'},dt:function(t){return new Date(t).toLocaleString('en',{month:'numeric',day:'numeric',year:'numeric',hour:'numeric',minute:'numeric'})},t:function(m){const o=this._('o');o.textContent=m;o.style.display='block';setTimeout(function(){o.style.display='none'},3e3)},g:function(s){const l=this._('loadingOverlay');if(l)l.style.display=s?'flex':'none'},hm:function(){this._('m').style.display='none';document.body.style.overflow='';const t=this._('t');if(t)t.value=''}};new A;
