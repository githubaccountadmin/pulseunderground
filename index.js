const D={A:'0xD9157453E2668B2fc45b7A803D3FEF3642430cC0',B:[{inputs:[{name:"_queryId",type:"bytes32"},{name:"_value",type:"bytes"},{name:"_nonce",type:"uint256"},{name:"_queryData",type:"bytes"}],name:"submitValue",outputs:[],stateMutability:"nonpayable",type:"function"},{inputs:[{name:"_queryId",type:"bytes32"}],name:"getNewValueCountbyQueryId",outputs:[{name:"",type:"uint256"}],stateMutability:"view",type:"function"}],u:'api.scan.pulsechain.com/api/v2/addresses/',b:100,m:10,r:3,t:3e5,c:'0x434F4D4D454E54'},A=function(){this.e=window.ethers,this.s={i:[],l:0,n:0,p:null,r:new Set,t:0,a:0},this._=document.getElementById.bind(document),this.setup()};A.prototype={setup:function(){const s=this;document.body.insertAdjacentHTML('beforeend','<div id=m class="modal"><div id=n class="modal-content"><button class=x>×</button><div id=r class="original-post"></div><div id=s class="comments-section"><div id=l class="comments-list"></div><div class=i><textarea id=t placeholder="Write a comment..."></textarea><button id=cs>💬</button></div></div></div></div><div id=o class="status-message"></div>'),document.addEventListener('click',e=>{const t=e.target;if(!t)return;if(t.classList.contains('x')){s.hm()}else if(t.matches('.action-btn')){const p=t.closest('.report-actions'),d=p?.dataset;d&&(t.dataset.action==='comment'?s.sm(d.queryId):t.dataset.action==='dispute'&&window.disputeNews&&window.disputeNews(d.reporter,d.queryId,d.timestamp))}else{const i=t.id;i==='connectWallet'?s.w():i==='publishStory'?s.ps():i==='loadMoreButton'?s.c():i==='cs'?s.pc():i==='search-button'&&s.se()}});const x=this._('t');x&&new ResizeObserver(()=>requestAnimationFrame(()=>x.style.height=x.scrollHeight+'px')).observe(x);const i=this._('search-input');i&&(i.addEventListener('keypress',e=>e.key==='Enter'&&s.se()),i.addEventListener('input',e=>{const v=e.target.value.trim();!v&&s.s.a&&(s.s.a=0,s.r(s.s.i),s._('loadMoreButton').style.display='none')}));window.addEventListener('scroll',()=>{!s.s.l&&!s.s.n&&!s.s.a&&window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-500&&s.c()});this._('loadMoreButton').style.display='none',this.f(!0),setInterval(()=>s.c(),D.t)},ps:async function(){const c=this._('reportContent').value.trim();if(!c)return this.t('Please enter content');this._('publishStory').disabled=!0,this.g(1);try{if(!this.contract)throw new Error("Wallet not connected");const d=this.e.utils.defaultAbiCoder.encode(['string','bytes'],["StringQuery",this.e.utils.toUtf8Bytes(c)]),i=this.e.utils.keccak256(d),n=await this.contract.getNewValueCountbyQueryId(i),v=this.e.utils.defaultAbiCoder.encode(['string','bytes'],["NEWS",this.e.utils.toUtf8Bytes(c)]),g=await this.contract.estimateGas.submitValue(i,v,n,d),t=await this.contract.submitValue(i,v,n,d,{gasLimit:g.mul(120).div(100)});await t.wait(),this.t('Story published!'),this._('reportContent').value='';const s={content:c,reporter:await this.signer.getAddress(),timestamp:new Date().toISOString(),queryId:i};this.s.i.unshift(s),this.r([s],!0)}catch(e){console.error('Publish error:',e),this.t(e.message)}finally{this._('publishStory').disabled=!1,this.g(0)}},tx:async function(p){const u=`https://${D.u}${D.A}/transactions?filter=to&sort=desc&limit=${D.b}${p?'&'+new URLSearchParams(p):''}`;if(this.s.r.has(u))return new Promise(r=>setTimeout(()=>r(this.tx(p)),100));this.s.r.add(u);try{return await(await fetch(u)).json()}catch(e){throw console.error('API Error:',e),e}finally{this.s.r.delete(u)}},se:function(){const i=this._('search-input'),v=i?.value.trim().toLowerCase();if(!v)return;const f=this.s.i.filter(x=>this.sh(x.reporter).toLowerCase().includes(v)||x.content.toLowerCase().includes(v));this.r(f),this.s.a=1,this._('loadMoreButton').style.display='block',this.t(`Found ${f.length} result(s)`)},c:async function(){if(this.s.l||Date.now()-this.s.t<3e4)return;this.s.l=1,this.g(1);try{const r=await this.tx(this.s.p),n=await this.p(r),u=n.filter(x=>!this.s.i.some(y=>y.queryId===x.queryId));u.length&&(this.s.i.unshift(...u),this.r(u,1),this.t('+'+u.length)),this.s.t=Date.now()}catch(e){console.error('Update error:',e)}finally{this.s.l=0,this.g(0)}},f:async function(x){if(this.s.l||this.s.n&&!x)return;this.s.l=1,this.g(1);if(x){this.s.i=[],this.s.n=0,this.s.p=null}try{const n=[];while(n.length<D.m&&!this.s.n){const r=await this.tx(this.s.p),i=await this.p(r);n.push(...i)}if(n.length){this.s.i=x?n:this.s.i.concat(n),this.r(n,!x)}this._('loadMoreButton').style.display=this.s.n?'none':'block'}catch(e){console.error('Feed error:',e)}finally{this.s.l=0,this.g(0)}},p:async function(b){if(!b?.items?.length){this.s.n=1;return[]}const i=[];for(const t of b.items)if(t.method==='submitValue'&&t.decoded_input?.parameters?.length>=4)try{const[y,b]=this.e.utils.defaultAbiCoder.decode(['string','bytes'],t.decoded_input.parameters[3].value);if(y==='StringQuery'){const c=this.e.utils.toUtf8String(b).trim();c&&i.push({content:c,reporter:t.from.hash||t.from,timestamp:t.timestamp||t.block_timestamp,queryId:t.decoded_input.parameters[0].value})}}catch(e){}this.s.p=b.next_page_params||null,this.s.n=!this.s.p;return i},r:function(i,a){if(!i.length&&!a)return this._('newsFeed').innerHTML='No items';const f=document.createDocumentFragment(),t=document.createElement('template');i.forEach(m=>{t.innerHTML=`<article class="news-item"><div class="reporter-info"><img src="newTRBphoto.jpg" alt="R" class="avatar"><div class="reporter-details"><span class="reporter-name">${this.sh(m.reporter)}</span>· ${this.dt(m.timestamp)}</div></div><div class="report-content">${m.content.split('\n\n').map(p=>'<p>'+p.replace(/\n/g,'<br>')+'</p>').join('')}</div><div class="report-actions"data-reporter="${m.reporter}"data-query-id="${m.queryId}"data-timestamp="${m.timestamp}"><button class="action-btn"data-action="comment">💬</button><button class="action-btn"data-action="like">👍</button><button class="action-btn"data-action="dispute">⚠️</button><button class="action-btn"data-action="vote">✓</button></div></article>`,f.appendChild(t.content.firstChild)});const n=this._('newsFeed');a?n.appendChild(f):(n.textContent='',n.appendChild(f)),n.style.visibility='visible'},w:async function(){try{if(!window.ethereum)throw'Please install MetaMask';const p=new this.e.providers.Web3Provider(window.ethereum);await p.send('eth_requestAccounts',[]);const s=p.getSigner(),a=await s.getAddress();this._('connectWallet').style.display='none',this._('walletInfo').style.display='block',this._('walletAddress').textContent=this.sh(a),this._('publishStory').disabled=!1,this._('reportContent').placeholder="What's happening?",this.contract=new this.e.Contract(D.A,D.B,s),this.signer=s,this.t('Connected')}catch(e){console.error('Wallet error:',e),this.t(e.message==='User rejected the request.'?'Connection cancelled':e.message||'Failed to connect wallet')}},sm:function(i){const r=this.s.i.find(x=>x.queryId===i);if(!r)return;this.cr=r;this._('r').innerHTML=`<div class="reporter-info"><img src="newTRBphoto.jpg"alt=R class="avatar"><div class="reporter-details"><span class="reporter-name">${this.sh(r.reporter)}</span><span class="report-timestamp">${this.dt(r.timestamp)}</span></div></div><div class="report-content">${r.content.split('\n\n').map(p=>'<p>'+p.replace(/\n/g,'<br>')+'</p>').join('')}</div>`,this.lc(i),this._('m').style.display='flex',document.body.style.overflow='hidden'},lc:async function(i){const l=this._('l');if(!l)return;l.innerHTML='<div class="loading">Loading comments...</div>';try{const c=await this.gc(i);l.innerHTML=c&&c.length?c.map(c=>`<div class="comment"><div class="comment-header"><img src="newTRBphoto.jpg" alt="Commenter" class="avatar"><div class="reporter-details"><span class="reporter-name">${this.sh(c.author)}</span><span class="report-timestamp">${this.dt(c.timestamp)}</span></div></div><div class="comment-text">${c.text}</div></div>`).join(''):'No comments yet'}catch{l.innerHTML='Failed to load comments'}},pc:async function(){const t=this._('t'),b=this._('cs');if(!t||!b)return;const v=t.value.trim();if(!v)return;b.disabled=1;this.t('Posting comment...');try{if(!window.ethereum)throw'Please install MetaMask';const p=new this.e.providers.Web3Provider(window.ethereum);await p.send('eth_requestAccounts',[]);const s=p.getSigner();const tx=await s.sendTransaction({to:D.A,value:this.e.utils.parseEther('0'),data:this.e.utils.hexlify(this.e.utils.toUtf8Bytes(`${this.cr.queryId}:${v}`))});await tx.wait();t.value='';this.lc(this.cr.queryId);this.t('Comment posted ✓')}catch(e){console.error('Comment error:',e);this.t(e.message||'Failed to post comment')}finally{b.disabled=0}},gc:async function(i){const r=await this.tx(),c=[];for(const t of r.items||[])if(t.input&&t.value==='0')try{const rawData=this.e.utils.toUtf8String(t.input);const[queryId,comment]=rawData.split(':');if(queryId===i){c.push({text:comment,author:t.from.hash||t.from,timestamp:t.timestamp||t.block_timestamp})}}catch(e){}return c},sh:function(a){return a?.length>10?a.slice(0,6)+'...'+a.slice(-4):a||'-'},dt:function(t){return new Date(t).toLocaleString('en',{month:'numeric',day:'numeric',year:'numeric',hour:'numeric',minute:'numeric'})},t:function(m){const o=this._('o');o.textContent=m,o.style.display='block',setTimeout(()=>o.style.display='none',3e3)},g:function(s){const l=this._('loadingOverlay');l&&(l.style.display=s?'flex':'none')},hm:function(){this._('m').style.display='none',document.body.style.overflow='';const t=this._('t');t&&(t.value='')}},new A;
