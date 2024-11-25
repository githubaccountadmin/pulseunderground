(()=>{
    let w=window,d=document,E=w.ethers,q=d.querySelector.bind(d),
        _='display',v='none',z='block',
        V=new Map,T=new Set,C=new WeakMap,
        Y={p:0,s:0,n:[],t:Date.now(),l:0,m:0},
        U=new Uint8Array(32);

    // Contract address initialization
    for(let i=0;i<32;i++)U[i]=parseInt('D9157453E2668B2fc45b7A803D3FEF3642430cC0'.slice(i*2,i*2+2),16);

    // Utility functions
    const G={
        $:i=>C.get(i)||C.set(i,q('#'+i)).get(i),
        L:(k,d,a=w.ethereum?.selectedAddress)=>{
            try{return k?localStorage.setItem(`p${a}${d}`,JSON.stringify(k)):JSON.parse(localStorage.getItem(`p${a}${d}`))}catch(e){}
        },
        H:s=>s?.slice(0,6)+'...'+s?.slice(-4)||'?',
        // Optimized render function
        R:(function(){
            let t,f;
            return(m,x)=>{
                if(f=G.$('newsFeed'),!m.length&&!x)return f.innerHTML='<p>No news</p>';
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
        // Added: Decode content function
        D:b=>{
            while(b.length>0&&b[b.length-1]===0)b=b.slice(0,-1);
            try{return E.utils.toUtf8String(b)}catch(e){return E.utils.toUtf8String(b.slice(0,e.offset),true)}
        }
    },
    X=new Proxy({},{get:(_,p)=>V.get(p)||V.set(p,new AbortController).get(p)});

    // Load news feed function (restored)
    const F=async(r=0)=>{
        if(Y.l||(!r&&Y.m))return;
        Y.l=1;
        G.$('loadingOverlay').style[_]=z;
        
        if(r){
            Y.n=[];
            Y.m=0;
            Y.p=null;
            G.$('newsFeed').innerHTML='';
        }

        try{
            const u=`https://api.scan.pulsechain.com/api/v2/addresses/${E.utils.getAddress(U)}/transactions?filter=to&sort=desc&limit=100${Y.p?'&'+new URLSearchParams(Y.p).toString():''}`;
            const r=await fetch(u);
            const d=await r.json();
            
            if(!d.items?.length){Y.m=1;return}
            
            let n=[];
            for(let t of d.items){
                if(t.method==='submitValue'&&t.decoded_input?.parameters?.length>=4){
                    try{
                        const[q,b]=E.utils.defaultAbiCoder.decode(['string','bytes'],t.decoded_input.parameters[3].value);
                        if(q==="StringQuery"){
                            const c=G.D(b);
                            if(c.trim())n.push({
                                content:c,
                                reporter:t.from.hash||t.from,
                                timestamp:t.timestamp||t.block_timestamp,
                                queryId:t.decoded_input.parameters[0].value
                            });
                        }
                    }catch(e){console.warn("Decode error:",e)}
                }
            }
            
            if(n.length){
                Y.n.push(...n);
                G.R(n,!r);
                G.L(Y.n.slice(0,50),'n');
            }
            
            Y.p=d.next_page_params||null;
            Y.m=!Y.p;
            G.$('loadMoreButton').style[_]=Y.m?v:z;
            
        }catch(e){
            console.error('Feed error:',e);
        }finally{
            Y.l=0;
            G.$('loadingOverlay').style[_]=v;
        }
    };

    // Initialize
    d.addEventListener('DOMContentLoaded',async _=>{
        // Wallet connection function
        const M=async _=>{
            try{
                if(!w.ethereum)throw'📱';
                Y.p=new E.providers.Web3Provider(w.ethereum);
                await Y.p.send("eth_requestAccounts",[]);
                Y.s=Y.p.getSigner();
                let a=await Y.s.getAddress();
                
                // Create contract instance with full ABI
                Y.c=new E.Contract(U,[[
                    {"inputs":[{"name":"_queryId","type":"bytes32"},{"name":"_value","type":"bytes"},{"name":"_nonce","type":"uint256"},{"name":"_queryData","type":"bytes"}],"name":"submitValue","outputs":[],"stateMutability":"nonpayable","type":"function"},
                    {"inputs":[{"name":"_queryId","type":"bytes32"}],"name":"getNewValueCountbyQueryId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
                ][0]],Y.s);

                ['connectWallet','publishStory','walletInfo','walletAddress'].map(i=>{
                    let e=G.$(i);
                    e&&(e.style[_]=i=='walletInfo'?z:v,i=='walletAddress'&&(e.textContent=G.H(a)),i=='publishStory'&&(e.disabled=0))
                });
                
                G.$('reportContent').placeholder="What's happening?";
                
                // Wallet event listeners
                w.ethereum.removeEventListener('chainChanged',location.reload);
                w.ethereum.removeEventListener('accountsChanged',M);
                w.ethereum.addEventListener('chainChanged',_=>location.reload());
                w.ethereum.addEventListener('accountsChanged',M);
            }catch(e){console.log(e)}
        };

        // Post submission function
        const P=async _=>{
            let c=G.$('reportContent'),p=G.$('publishStory'),o=G.$('loadingOverlay'),v=c.value.trim();
            if(!v||!Y.s)return;
            p.disabled=1;
            o.style[_]=z;
            try{
                let b=E.utils.toUtf8Bytes(v),
                    q=E.utils.defaultAbiCoder.encode(['string','bytes'],['StringQuery',b]),
                    i=E.utils.keccak256(q),
                    n=await Y.c.getNewValueCountbyQueryId(i),
                    t=await Y.c.submitValue(i,E.utils.defaultAbiCoder.encode(['string','bytes'],['NEWS',b]),n,q,{
                        gasLimit:(await Y.c.estimateGas.submitValue(i,v,n,q)).mul(120).div(100)
                    });
                await t.wait();
                c.value='';
                let s={content:v,reporter:await Y.s.getAddress(),timestamp:new Date().toISOString(),queryId:i};
                Y.n.unshift(s);
                G.L(Y.n,'n');
                G.R([s],1)
            }catch(e){console.log(e)}finally{
                p.disabled=0;
                o.style[_]=v
            }
        };

        // Event listeners
        d.addEventListener('click',e=>{
            let t=e.target;
            if(t.tagName==='BUTTON'){
                let a=t.dataset.a;
                if(a){
                    e.preventDefault();
                    let r=t.dataset.r,q=t.dataset.q,m=t.dataset.t;
                    console.log(a,r,q,m)
                }
            }
        });

        ['connectWallet','publishStory','search-input','loadMoreButton'].map((i,x)=>{
            let e=G.$(i),h=X[i];
            h&&h.abort();
            if(e){
                if(x<2)e.addEventListener('click',x?P:M,{signal:h.signal});
                else if(x===2){
                    let s=_=>{
                        let v=e.value.toLowerCase();
                        T.add(v);
                        setTimeout(_=>T.delete(v),300);
                        if(T.size>1)return;
                        G.R(Y.n.filter(i=>G.H(i.reporter).toLowerCase().includes(v)||i.content.toLowerCase().includes(v)))
                    };
                    e.addEventListener('input',s,{signal:h.signal});
                    e.addEventListener('keypress',e=>'Enter'==e.key&&s(),{signal:h.signal})
                }else{
                    e.addEventListener('click',()=>F(),{signal:h.signal});
                }
            }
        });

        // Initial load
        let L=G.L(0,'n');
        L&&(Y.n=L,G.R(L));
        F();
    });
})();
