(()=>{
    let w=window,d=document,E=w.ethers,
        _='display',v='none',z='block',
        V=new Map,T=new Set,
        Y={p:0,s:0,n:[],t:Date.now(),l:0,m:0,last:null,min:10}, // Added min items and last params
        U='0xd9157453e2668b2fc45b7a803d3fef3642430cc0';

    const A = [
        {"inputs":[{"name":"_queryId","type":"bytes32"},{"name":"_value","type":"bytes"},{"name":"_nonce","type":"uint256"},{"name":"_queryData","type":"bytes"}],"name":"submitValue","outputs":[],"stateMutability":"nonpayable","type":"function"},
        {"inputs":[{"name":"_queryId","type":"bytes32"}],"name":"getNewValueCountbyQueryId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
    ];

    const G={
        $:(()=>{
            const cache = new Map();
            return i => cache.get(i) || cache.set(i, d.querySelector('#'+i)).get(i);
        })(),
        L:async(k,d)=>{
            try{
                const accounts = await w.ethereum?.request({method: 'eth_accounts'});
                const a = accounts?.[0];
                return k ? 
                    localStorage.setItem(`p${a}${d}`,JSON.stringify(k)) : 
                    JSON.parse(localStorage.getItem(`p${a}${d}`));
            }catch(e){}
        },
        H:s=>s?.slice(0,6)+'...'+s?.slice(-4)||'?',
        R:(function(){
            let t,f;
            return(m,x)=>{
                if(f=G.$('newsFeed'),!m?.length&&!x)return f.innerHTML='<p>No news items to display.</p>';
                t=t||d.createDocumentFragment();
                let h='';
                m.map(i=>{
                    h+=`<article class="news-item"><div class="reporter-info"><img src="newTRBphoto.jpg" alt="" class="avatar"><div class="reporter-details"><span>${G.H(i.reporter)}</span><span>·${new Date(i.timestamp).toLocaleString()}</span></div></div><div>${i.content.replace(/[<>"'&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]))}</div><div class="report-actions">${['💬','👍','⚠️','✓'].map((e,j)=>`<button data-a="${'cldt'[j]}" data-r="${i.reporter}"${j==2?` data-q="${i.queryId}" data-t="${i.timestamp}"`:''}">${e}</button>`).join('')}</div></article>`
                });
                t.innerHTML=h;
                x||(f.innerHTML='');
                requestAnimationFrame(()=>{f.appendChild(t.cloneNode(true));f.style.visibility='visible'})
            }
        })(),
        D:b=>{
            while(b.length>0&&b[b.length-1]===0)b=b.slice(0,-1);
            try{return E.utils.toUtf8String(b)}catch(e){return E.utils.toUtf8String(b.slice(0,e.offset),true)}
        }
    };

    const X=new Map();

    // Completely revamped feed loading function
    const F=async(r=0)=>{
        if(Y.l||(!r&&Y.m))return;
        Y.l=1;
        G.$('loadingOverlay').style[_]=z;
        
        if(r){
            Y.n=[];
            Y.m=0;
            Y.last=null;
            G.$('newsFeed').innerHTML='';
        }

        let newItems = [];
        try {
            // Continue loading until we have minimum items or no more data
            while(newItems.length < Y.min && !Y.m) {
                const u=`https://api.scan.pulsechain.com/api/v2/addresses/${U}/transactions?filter=to&sort=desc&limit=100${Y.last?'&'+new URLSearchParams(Y.last).toString():''}`;
                console.log('Fetching:', u);
                const r=await fetch(u);
                if(!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                const d=await r.json();
                console.log('Response items:', d?.items?.length);
                
                if(!d?.items?.length){
                    Y.m=1;
                    break;
                }
                
                for(let t of d.items){
                    if(t.method === 'submitValue' && t.decoded_input?.parameters?.length >= 4){
                        try{
                            const [q,b] = E.utils.defaultAbiCoder.decode(
                                ['string','bytes'],
                                t.decoded_input.parameters[3].value
                            );
                            if(q === "StringQuery"){
                                const c = G.D(b);
                                if(c.trim()) newItems.push({
                                    content: c,
                                    reporter: t.from.hash || t.from,
                                    timestamp: t.timestamp || t.block_timestamp,
                                    queryId: t.decoded_input.parameters[0].value
                                });
                            }
                        }catch(e){
                            console.warn("Decode error:", e);
                        }
                    }
                }
                
                Y.last = d.next_page_params || null;
                Y.m = !Y.last;
                
                if(Y.m) break; // No more pages
            }
            
            console.log('Processed items total:', newItems.length);
            
            if(newItems.length){
                Y.n.push(...newItems);
                G.R(newItems, !r);
                await G.L(Y.n.slice(0,50), 'n');
            } else if(!Y.n.length) {
                G.R([]);
            }
            
            G.$('loadMoreButton').style[_] = Y.m ? v : z;
            
        }catch(e){
            console.error('Feed error:', e);
            if(!Y.n.length) G.R([]);
        }finally{
            Y.l=0;
            G.$('loadingOverlay').style[_]=v;
        }
    };

    // Initialize
    d.addEventListener('DOMContentLoaded',async _=>{
        // ... rest of the code remains the same ...

        setupListeners();
        const L=await G.L(0,'n');
        if(L){
            Y.n=L;
            G.R(L);
        }
        await F(1); // Force initial load
    });
})();
