const C={A:'0xD9157453E2668B2fc45b7A803D3FEF3642430cC0',B:[{i:[{n:"_queryId",t:"bytes32"},{n:"_value",t:"bytes"},{n:"_nonce",t:"uint256"},{n:"_queryData",t:"bytes"}],n:"submitValue",o:[]},{i:[{n:"_queryId",t:"bytes32"}],n:"getNewValueCountbyQueryId",o:[{t:"uint256"}]}],u:'https://api.scan.pulsechain.com/api/v2/addresses/',b:100,m:10,r:3,t:3e5,k:'i',x:50,c:'0x434F4D4D454E54:'};

class P{constructor(m=100){this.d=new Map;this.t=new Map;this.m=m}g(k){const v=this.d.get(k);v&&this.t.set(k,Date.now());return v}s(k,v){this.c();this.d.set(k,v);this.t.set(k,Date.now())}c(){const n=Date.now();[...this.t].filter(([k,t])=>n-t>C.t).forEach(([k])=>{this.d.delete(k);this.t.delete(k)})}}

class A{
    constructor(){
        this.e=window.ethers;
        this.h=new P;
        this.s={i:[],l:!1,n:!1,p:null,r:new Set};
        this.$=i=>this._e?.[i]||(this._e={})[i]||(this._e[i]=document.getElementById(i));
        this.init()
    }

    async init(){
        this.ui();
        this.bindEvents();
        await this.loadStored();
        this.feed();
        setInterval(()=>this.h.c(),C.t)
    }

    async loadStored(){
        try{
            const s=localStorage.getItem(C.k);
            if(s)this.s.i=JSON.parse(s)
        }catch(e){
            console.warn(e)
        }
    }

    ui(){
        document.body.insertAdjacentHTML('beforeend',`<div id="m"class="o"><div class="c"><button class="x">&times;</button><div id="r"></div><div id="s"><div id="l"></div><div class="i"><textarea id="t"placeholder="Comment"></textarea><button id="cs">Send</button></div></div></div></div>`);
        document.head.appendChild(Object.assign(document.createElement('style'),{textContent:'.o{display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:1000}.c{width:90%;max-width:600px;margin:50px auto;background:#13101c;border-radius:12px;padding:20px;max-height:90vh;overflow-y:auto;position:relative}.x{position:absolute;right:20px;top:20px;background:0;border:0;color:#fff;font-size:24px;cursor:pointer}.i{margin-top:20px;border-top:1px solid #2a2438;padding-top:20px}#t{width:100%;min-height:100px;background:#1a1327;border:1px solid #2a2438;border-radius:8px;padding:12px;color:#fff;margin-bottom:10px;resize:vertical}.m{padding:15px;border-bottom:1px solid #2a2438}'}))
    }

    bindEvents(){
        document.addEventListener('click',e=>{
            const t=e.target;
            if(t.id==='connectWallet')this.connect();
            else if(t.id==='publishStory')this.submit();
            else if(t.id==='loadMoreButton')this.feed();
            else if(t.id==='cs')this.postComment();
            else if(t.className==='x')this.hideModal();
            else if(t.matches('.action-btn'))this.handleAction(t)
        });

        const s=this.$('searchInput');
        if(s){
            let t;
            s.addEventListener('input',()=>{
                clearTimeout(t);
                t=setTimeout(()=>this.search(),300)
            })
        }

        const c=this.$('t');
        c&&new ResizeObserver(()=>requestAnimationFrame(()=>c.style.height=c.scrollHeight+'px')).observe(c)
    }

    handleAction(t){
        const c=t.closest('.report-actions');
        if(!c)return;
        const action=t.dataset.action;
        if(action==='comment')this.showModal(c.dataset.queryId);
        else if(action==='dispute')window.disputeNews?.(c.dataset.reporter,c.dataset.queryId,c.dataset.timestamp);
        else console.log(`${action}:${this.short(c.dataset.reporter)}`)
    }

    async getTx(p){const k=p?JSON.stringify(p):'_';const v=this.h.g(k);if(v)return v;const u=`${C.u}${C.A}/transactions?filter=to&sort=desc&limit=${C.b}${p?'&'+new URLSearchParams(p):''}`;if(this.s.r.has(u))return new Promise(r=>setTimeout(()=>r(this.getTx(p)),100));this.s.r.add(u);try{const r=await(await fetch(u)).json();this.h.s(k,r);return r}finally{this.s.r.delete(u)}}

    async feed(r=!1){if(this.s.l||this.s.n&&!r)return;this.s.l=!0;this.tog(!0);if(r){this.s.i=[];this.s.n=!1;this.s.p=null;this.$('newsFeed').textContent=''}try{const q=[],n=[];while(n.length<C.m&&!this.s.n){q.push(this.getTx(this.s.p));if(q.length>=C.r){const i=await this.proc(await q.shift());n.push(...i)}}while(q.length){const i=await this.proc(await q.shift());n.push(...i)}if(n.length){this.s.i=r?n:[...this.s.i,...n];this.render(n,!r);localStorage.setItem(C.k,JSON.stringify(this.s.i.slice(0,C.x)))}this.$('loadMoreButton').style.display=this.s.n?'none':'block'}catch(e){console.error(e)}finally{this.s.l=!1;this.tog(!1)}}

    async proc(b){if(!b?.items?.length){this.s.n=!0;return[]}const i=await Promise.all(b.items.filter(t=>t.method==='submitValue'&&t.decoded_input?.parameters?.length>3).map(async t=>{try{const[y,b]=this.e.utils.defaultAbiCoder.decode(['string','bytes'],t.decoded_input.parameters[3].value);if(y!=='StringQuery')return null;const c=await this.decode(b);return c.trim()?{content:c,reporter:t.from.hash||t.from,timestamp:t.timestamp||t.block_timestamp,queryId:t.decoded_input.parameters[0].value}:null}catch{return null}}));this.s.p=b.next_page_params||null;this.s.n=!this.s.p;return i.filter(Boolean)}

    async submit(){const c=this.$('reportContent').value.trim();if(!c)return;this.$('publishStory').disabled=!0;this.tog(!0);try{if(!this.w)throw'Connect wallet';const q=this.e.utils.defaultAbiCoder.encode(['string','bytes'],['StringQuery',this.e.utils.toUtf8Bytes(c)]),i=this.e.utils.keccak256(q),n=await this.w.getNewValueCountbyQueryId(i),v=this.e.utils.defaultAbiCoder.encode(['string','bytes'],['NEWS',this.e.utils.toUtf8Bytes(c)]),g=await this.w.estimateGas.submitValue(i,v,n,q),t=await this.w.submitValue(i,v,n,q,{gasLimit:g.mul(120).div(100)});await t.wait();const ni={content:c,reporter:await this.w.signer.getAddress(),timestamp:new Date().toISOString(),queryId:i};this.s.i.unshift(ni);this.render([ni],!0);this.$('reportContent').value='';localStorage.setItem(C.k,JSON.stringify(this.s.i.slice(0,C.x)))}catch(e){console.error(e)}finally{this.$('publishStory').disabled=!1;this.tog(!1)}}

    async connect(){try{if(!window.ethereum)throw'Install MetaMask';const p=new this.e.providers.Web3Provider(window.ethereum);await p.send('eth_requestAccounts',[]);const s=p.getSigner(),a=await s.getAddress();this.$('connectWallet').style.display='none';this.$('walletInfo').style.display='block';this.$('walletAddress').textContent=this.short(a);this.$('publishStory').disabled=!1;this.w=new this.e.Contract(C.A,C.B,s)}catch(e){console.error(e)}}

    render(i,a){if(!i.length&&!a)return this.$('newsFeed').innerHTML='<p>No items</p>';const f=document.createDocumentFragment(),t=document.createElement('template');i.forEach(m=>{t.innerHTML=`<article class="news-item"><div class="reporter-info"><img src="newTRBphoto.jpg" alt="R" class="avatar"><div class="reporter-details"><span class="reporter-name">${this.short(m.reporter)}</span><span class="report-timestamp">· ${this.date(m.timestamp)}</span></div></div><div class="report-content">${m.content.split('\n\n').map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join('')}</div><div class="report-actions"data-reporter="${m.reporter}"data-query-id="${m.queryId}"data-timestamp="${m.timestamp}"><button class="action-btn"data-action="comment">Comment</button><button class="action-btn"data-action="like">Like</button><button class="action-btn"data-action="dispute">Dispute</button><button class="action-btn"data-action="vote">Vote</button></div></article>`;f.appendChild(t.content.firstChild)});requestAnimationFrame(()=>{const n=this.$('newsFeed');a||n.textContent='';n.appendChild(f);n.style.visibility='visible'})}

    async decode(b){const k=b.toString();const v=this.h.g(k);if(v)return v;try{let e=b.length;while(e>0&&b[e-1]===0)e--;const c=this.e.utils.toUtf8String(b.slice(0,e));this.h.s(k,c);return c}catch(e){const c=this.e.utils.toUtf8String(b.slice(0,e.offset),!0);this.h.s(k,c);return c}}

    async showModal(i){const r=this.s.i.find(x=>x.queryId===i);if(!r)return;this.cr=r;this.$('r').innerHTML=`<div class="report-full"><div class="reporter-info"><img src="newTRBphoto.jpg"alt="R"class="avatar"><div class="reporter-details"><span class="reporter-name">${this.short(r.reporter)}</span><span class="report-timestamp">· ${this.date(r.timestamp)}</span></div></div><div class="report-content">${r.content.split('\n\n').map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join('')}</div></div>`;this.loadComments(i);this.$('m').style.display='block'}

    async loadComments(i){const l=this.$('l');l.innerHTML='<div class="loading">Loading...</div>';try{const c=await this.getComments(i);l.innerHTML=c.length?c.map(c=>`<div class="m"><div class="h"><span class="a">${this.short(c.author)}</span><span class="t">· ${this.date(c.timestamp)}</span></div><div class="text">${c.text}</div></div>`).join(''):'<div class="n">No comments</div>'}catch(e){l.innerHTML='<div class="e">Failed to load</div>'}}

    async getComments(i){const k=`c${i}`;const v=this.h.g(k);if(v)return v;const r=await this.getTx(),c=r.items?.filter(t=>t.value==='0'&&t.input?.startsWith(C.c)).map(t=>{try{const[q,x]=this.e.utils.defaultAbiCoder.decode(['bytes32','string'],'0x'+t.input.slice(C.c.length));return q===i?{text:x,author:t.from.hash||t.from,timestamp:t.timestamp||t.block_timestamp}:null}catch{return null}}).filter(Boolean);this.h.s(k,c);return c}

    async postComment(){const t=this.$('t').value.trim();if(!t)return;try{if(!window.ethereum)throw'Install MetaMask';const p=new this.e.providers.Web3Provider(window.ethereum);const s=await p.send('eth_requestAccounts',[]).then(()=>p.getSigner());await(await s.sendTransaction({to:C.A,value:'0',data:C.c+this.e.utils.defaultAbiCoder.encode(['bytes32','string'],[this.cr.queryId,t]).slice(2)})).wait();this.$('t').value='';this.loadComments(this.cr.queryId)}catch(e){console.error(e)}}

    hideModal(){this.$('m').style.display='none'}

    search(){const t=this.$('searchInput').value.toLowerCase();if(!t){this.s.x=!1;this.render(this.s.i);this.$('loadMoreButton').style.display='block';return}const f=this.s.i.filter(i=>this.short(i.reporter).toLowerCase().includes(t)||i.content.toLowerCase().includes(t));this.render(f);this.s.x=!0;this.$('loadMoreButton').style.display='none'}

    short=a=>a?.length>10?`${a.slice(0,6)}...${a.slice(-4)}`:a||'Unknown';
    date=t=>new Date(t).toLocaleString('en-US',{month:'numeric',day:'numeric',year:'numeric',hour:'numeric',minute:'numeric',hour12:!0});
    tog=s=>this.$('loadingOverlay').style.display=s?'flex':'none'
}

document.addEventListener('DOMContentLoaded',()=>new A);
