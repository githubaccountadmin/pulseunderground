(()=>{
    // Core variables with optimized naming
    let w=window,d=document,E=w.ethers,
        _='display',v='none',z='block',
        // State management
        Y={
            p:0,s:0,n:[],                  // Provider, signer, news array
            t:Date.now(),                  // Timestamp
            l:0,m:0,                       // Loading state, more data flag
            last:null,                     // Pagination
            min:10,                        // Minimum items to display
            batch:250,                     // Batch size
            cache:new Map(),               // Content cache
            tx:new Set()                   // Processed tx tracker
        },
        // Contract constants
        U='0xd9157453e2668b2fc45b7a803d3fef3642430cc0',
        A=[{"inputs":[{"name":"_queryId","type":"bytes32"},{"name":"_value","type":"bytes"},{"name":"_nonce","type":"uint256"},{"name":"_queryData","type":"bytes"}],"name":"submitValue","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_queryId","type":"bytes32"}],"name":"getNewValueCountbyQueryId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}];

    // Utility functions
    const G={
        // Optimized element cache
        $:(()=>{
            const c=new Map();
            return i=>c.get(i)||(e=d.querySelector('#'+i),c.set(i,e),e)
        })(),
        // Async storage with retry
        L:async(k,d,r=3)=>{
            while(r--) try{
                const a=(await w.ethereum?.request({method:'eth_accounts'}))?.[0];
                return k?
                    localStorage.setItem(`p${a}${d}`,JSON.stringify(k)):
                    JSON.parse(localStorage.getItem(`p${a}${d}`));
            }catch(e){if(!r)console.warn('Storage error:',e)}
        },
        // Address shortener
        H:s=>s?.slice(0,6)+'...'+s?.slice(-4)||'?',
        // Optimized renderer with virtualization
        R:(()=>{
            let t,f,v=[],p=0;
            const chunk=20;
            return(m,x)=>{
                if(f=G.$('newsFeed'),!m?.length&&!x)
                    return f.innerHTML='<p>No news items to display.</p>';
                
                if(!x)v=m;
                else v=v.concat(m);
                
                const render=()=>{
                    t=t||d.createDocumentFragment();
                    const end=Math.min(p+chunk,v.length);
                    let h='';
                    
                    for(let i=p;i<end;i++){
                        const item=v[i];
                        if(!item)continue;
                        h+=`<article class="news-item"><div class="reporter-info"><img src="newTRBphoto.jpg" alt="" class="avatar"><div class="reporter-details"><span>${G.H(item.reporter)}</span><span>·${new Date(item.timestamp).toLocaleString()}</span></div></div><div>${item.content.replace(/[<>"'&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]))}</div><div class="report-actions">${['💬','👍','⚠️','✓'].map((e,j)=>`<button data-a="${'cldt'[j]}" data-r="${item.reporter}"${j==2?` data-q="${item.queryId}" data-t="${item.timestamp}"`:''}">${e}</button>`).join('')}</div></article>`;
                    }
                    
                    t.innerHTML=h;
                    if(!x&&p===0)f.innerHTML='';
                    requestAnimationFrame(()=>{
                        f.appendChild(t.cloneNode(true));
                        f.style.visibility='visible';
                        p=end;
                        if(p<v.length)setTimeout(render,50);
                    });
                };
                p=0;
                render();
            }
        })(),
        // Content decoder with cache
        D:b=>{
            const k=b.toString();
            if(Y.cache.has(k))return Y.cache.get(k);
            try{
                while(b.length>0&&b[b.length-1]===0)b=b.slice(0,-1);
                const r=E.utils.toUtf8String(b);
                Y.cache.set(k,r);
                return r;
            }catch(e){
                const r=E.utils.toUtf8String(b.slice(0,e.offset),true);
                Y.cache.set(k,r);
                return r;
            }
        }
    };

    // Event controller
    const X=new Map();

    // Optimized feed loader
    const F=async(r=0)=>{
        if(Y.l||(!r&&Y.m))return;
        Y.l=1;
        const o=G.$('loadingOverlay');
        o.style[_]=z;
        
        if(r){
            Y.n=[];
            Y.m=0;
            Y.last=null;
            Y.tx.clear();
            G.$('newsFeed').innerHTML='';
        }

        let newItems=[],processedCount=0;
        try{
            const loadBatch=async()=>{
                const u=`https://api.scan.pulsechain.com/api/v2/addresses/${U}/transactions?filter=to&sort=desc&limit=${Y.batch}${Y.last?'&'+new URLSearchParams(Y.last).toString():''}`;
                console.log('Fetching batch:',processedCount);
                const r=await fetch(u);
                if(!r.ok)throw new Error(`HTTP error! status: ${r.status}`);
                const d=await r.json();
                
                if(!d?.items?.length)return false;
                
                for(let t of d.items){
                    if(Y.tx.has(t.hash))continue;
                    Y.tx.add(t.hash);
                    
                    if(t.method==='submitValue'&&t.decoded_input?.parameters?.length>=4){
                        try{
                            const valueData=t.decoded_input.parameters[1].value;
                            const [newsType]=E.utils.defaultAbiCoder.decode(['string','bytes'],valueData);
                            
                            if(newsType==="NEWS"){
                                const [queryType,contentBytes]=E.utils.defaultAbiCoder.decode(
                                    ['string','bytes'],
                                    t.decoded_input.parameters[3].value
                                );
                                if(queryType==="StringQuery"){
                                    const content=G.D(contentBytes);
                                    if(content.trim())newItems.push({
                                        content,
                                        reporter:t.from.hash||t.from,
                                        timestamp:t.timestamp||t.block_timestamp,
                                        queryId:t.decoded_input.parameters[0].value
                                    });
                                }
                            }
                        }catch(e){
                            console.warn("Decode error:",e);
                        }
                    }
                }
                
                processedCount+=d.items.length;
                Y.last=d.next_page_params||null;
                return !Y.m;
            };

            let hasMore=await loadBatch();
            console.log(`Initial batch: ${newItems.length} news items from ${processedCount} transactions`);

            if(newItems.length<Y.min&&hasMore){
                const batchPromises=[];
                const maxParallelBatches=3;
                for(let i=0;i<maxParallelBatches&&hasMore;i++){
                    batchPromises.push(loadBatch());
                }
                await Promise.all(batchPromises);
            }
            
            console.log(`Total processed: ${processedCount} txs, found ${newItems.length} news items`);
            
            if(newItems.length){
                newItems.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
                Y.n.push(...newItems);
                G.R(newItems,!r);
                await G.L(Y.n.slice(0,50),'n');
            }else if(!Y.n.length){
                G.R([]);
            }
            
            G.$('loadMoreButton').style[_]=Y.m?v:z;
            
        }catch(e){
            console.error('Feed error:',e);
            if(!Y.n.length)G.R([]);
        }finally{
            Y.l=0;
            o.style[_]=v;
        }
    };

    // Initialize
    d.addEventListener('DOMContentLoaded',async()=>{
        const M=async()=>{
            try{
                if(!w.ethereum)throw'📱';
                Y.p=new E.providers.Web3Provider(w.ethereum);
                await Y.p.send("eth_requestAccounts",[]);
                Y.s=Y.p.getSigner();
                let a=await Y.s.getAddress();
                
                Y.c=new E.Contract(U,A,Y.s);

                ['connectWallet','publishStory','walletInfo','walletAddress'].map(i=>{
                    let e=G.$(i);
                    e&&(e.style[_]=i=='walletInfo'?z:v,
                        i=='walletAddress'&&(e.textContent=G.H(a)),
                        i=='publishStory'&&(e.disabled=0))
                });
                
                G.$('reportContent').placeholder="What's happening?";
                
                w.ethereum.removeEventListener('chainChanged',location.reload);
                w.ethereum.removeEventListener('accountsChanged',M);
                w.ethereum.addEventListener('chainChanged',()=>location.reload());
                w.ethereum.addEventListener('accountsChanged',M);
            }catch(e){console.warn('Wallet error:',e)}
        };

        const P=async()=>{
            let c=G.$('reportContent'),p=G.$('publishStory'),o=G.$('loadingOverlay'),val=c.value.trim();
            if(!val||!Y.s)return;
            p.disabled=1;
            o.style[_]=z;
            try{
                let b=E.utils.toUtf8Bytes(val),
                    q=E.utils.defaultAbiCoder.encode(['string','bytes'],['StringQuery',b]),
                    i=E.utils.keccak256(q),
                    n=await Y.c.getNewValueCountbyQueryId(i),
                    t=await Y.c.submitValue(i,E.utils.defaultAbiCoder.encode(['string','bytes'],['NEWS',b]),n,q,{
                        gasLimit:(await Y.c.estimateGas.submitValue(i,val,n,q)).mul(120).div(100)
                    });
                await t.wait();
                c.value='';
                let s={content:val,reporter:await Y.s.getAddress(),timestamp:new Date().toISOString(),queryId:i};
                Y.n.unshift(s);
                await G.L(Y.n,'n');
                G.R([s],1)
            }catch(e){console.warn('Post error:',e)}finally{
                p.disabled=0;
                o.style[_]=v
            }
        };

        d.addEventListener('click',e=>{
            let t=e.target;
            if(t.tagName==='BUTTON'){
                let a=t.dataset.a;
                if(a){
                    e.preventDefault();
                    let r=t.dataset.r,q=t.dataset.q,m=t.dataset.t;
                    if(a==='d'){
                        console.log(`Dispute: ${r}, ${q}, ${m}`);
                        w.disputeNews?.(r,q,m);
                    }
                }
            }
        });

        const setupEventListeners=()=>{
            ['connectWallet','publishStory','search-input','loadMoreButton'].forEach((i,x)=>{
                const e=G.$(i);
                if(!e)return;

                const oldController=X.get(i);
                if(oldController)oldController.abort();

                const controller=new AbortController();
                X.set(i,controller);

                if(x<2){
                    e.addEventListener('click',x?P:M,{signal:controller.signal});
                }else if(x===2){
                    let debounceTimeout;
                    const s=_=>{
                        clearTimeout(debounceTimeout);
                        debounceTimeout=setTimeout(()=>{
                            const v=e.value.toLowerCase();
                            G.R(Y.n.filter(i=>
                                G.H(i.reporter).toLowerCase().includes(v)||
                                i.content.toLowerCase().includes(v)
                            ));
                        },300);
                    };
                    e.addEventListener('input',s,{signal:controller.signal});
                    e.addEventListener('keypress',e=>'Enter'===e.key&&s(),{signal:controller.signal});
                }else{
                    e.addEventListener('click',()=>F(),{signal:controller.signal});
                }
            });
        };

        setupEventListeners();
        const L=await G.L(0,'n');
        if(L){
            Y.n=L;
            G.R(L);
        }
        await F(1);
    });
})();
