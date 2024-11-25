(()=>{
    let w=window,d=document,E=w.ethers,T=new Set,
        $=d.querySelector.bind(d),
        S={
            p:0,s:0,n:[],           // provider, signer, news
            l:0,                     // loading flag
            m:0,                     // no more data flag
            q:null,                  // last query params
            b:100                    // batch size
        },
        U='0xd9157453e2668b2fc45b7a803d3fef3642430cc0',
        A=[{"inputs":[{"name":"_queryId","type":"bytes32"},{"name":"_value","type":"bytes"},{"name":"_nonce","type":"uint256"},{"name":"_queryData","type":"bytes"}],"name":"submitValue","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_queryId","type":"bytes32"}],"name":"getNewValueCountbyQueryId","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}],
        // DOM Elements cache
        e={
            n:$('#newsFeed'),
            l:$('#loadingOverlay'),
            c:$('#reportContent'),
            p:$('#publishStory'),
            w:$('#walletInfo'),
            a:$('#walletAddress'),
            m:$('#loadMoreButton')
        };

    // Utility functions
    const H=s=>s?.slice(0,6)+'...'+s?.slice(-4)||'?',
          D=b=>{try{while(b.length>0&&b[b.length-1]===0)b=b.slice(0,-1);return E.utils.toUtf8String(b)}catch(e){return E.utils.toUtf8String(b.slice(0,e.offset),true)}},
          L=(k,d)=>k?localStorage.setItem(d,JSON.stringify(k)):JSON.parse(localStorage.getItem(d)),
          R=(m,x)=>{
              if(!m?.length&&!x)return e.n.innerHTML='<p>No news items to display.</p>';
              const h=m.map(i=>`<article class="news-item"><div class="reporter-info"><img src="newTRBphoto.jpg" alt="" class="avatar"><div class="reporter-details"><span>${H(i.reporter)}</span><span>·${new Date(i.timestamp).toLocaleString()}</span></div></div><div>${i.content.replace(/[<>"'&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]))}</div><div class="report-actions">${['💬','👍','⚠️','✓'].map((e,j)=>`<button data-a="${'cldt'[j]}" data-r="${i.reporter}"${j==2?` data-q="${i.queryId}" data-t="${i.timestamp}"`:''}">${e}</button>`).join('')}</div></article>`).join('');
              x||(e.n.innerHTML='');
              requestAnimationFrame(()=>{e.n.insertAdjacentHTML('beforeend',h);e.n.style.visibility='visible'});
          };

    // Load news feed
    const F=async(r=0)=>{
        if(S.l||(!r&&S.m))return;
        S.l=1;
        e.l.style.display='block';
        
        if(r){
            S.n=[];
            S.m=0;
            S.q=null;
            e.n.innerHTML='';
        }

        let n=[],c=0;
        try{
            const u=`https://api.scan.pulsechain.com/api/v2/addresses/${U}/transactions?filter=to&sort=desc&limit=${S.b}${S.q?'&'+new URLSearchParams(S.q):''}`
            const r=await fetch(u);
            const d=await r.json();
            
            if(!d?.items?.length){
                S.m=1;
                e.m.style.display='none';
                return;
            }
            
            for(let t of d.items){
                c++;
                if(t.method==='submitValue'&&t.decoded_input?.parameters?.length>=4)try{
                    // Fix: Only decode queryData parameter first
                    const[q,b]=E.utils.defaultAbiCoder.decode(['string','bytes'],t.decoded_input.parameters[3].value);
                    if(q==="StringQuery"){
                        const c=D(b).trim();
                        if(c)n.push({
                            content:c,
                            reporter:t.from.hash||t.from,
                            timestamp:t.timestamp||t.block_timestamp,
                            queryId:t.decoded_input.parameters[0].value
                        });
                    }
                }catch(e){console.warn('Decode error:',e)}
            }
            
            if(n.length){
                n.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
                S.n.push(...n);
                R(n,!r);
                L(S.n.slice(0,50),'news');
            }else if(!S.n.length)R([]);
            
            // Fix: Pagination handling
            S.q=d.next_page_params||null;
            S.m=!S.q;
            e.m.style.display=S.m?'none':'block';
            
            console.log(`Processed ${c} txs, found ${n.length} items`);
            
        }catch(e){
            console.error('Feed error:',e);
            R([]);
        }finally{
            S.l=0;
            e.l.style.display='none';
        }
    };

    // Submit news
    const P=async()=>{
        const v=e.c.value.trim();
        if(!v||!S.s)return;
        e.p.disabled=1;
        e.l.style.display='block';
        try{
            const b=E.utils.toUtf8Bytes(v),
                  q=E.utils.defaultAbiCoder.encode(['string','bytes'],['StringQuery',b]),
                  i=E.utils.keccak256(q),
                  n=await S.c.getNewValueCountbyQueryId(i),
                  t=await S.c.submitValue(i,E.utils.defaultAbiCoder.encode(['string','bytes'],['NEWS',b]),n,q,{
                      gasLimit:(await S.c.estimateGas.submitValue(i,v,n,q)).mul(120).div(100)
                  });
            await t.wait();
            e.c.value='';
            const s={content:v,reporter:await S.s.getAddress(),timestamp:new Date().toISOString(),queryId:i};
            S.n.unshift(s);
            L(S.n,'news');
            R([s],1);
        }catch(e){console.warn('Post error:',e)}
        finally{
            e.p.disabled=0;
            e.l.style.display='none';
        }
    };

    // Connect wallet
    const M=async()=>{
        try{
            if(!w.ethereum)throw'📱';
            S.p=new E.providers.Web3Provider(w.ethereum);
            await S.p.send("eth_requestAccounts",[]);
            S.s=S.p.getSigner();
            const a=await S.s.getAddress();
            S.c=new E.Contract(U,A,S.s);
            $('#connectWallet').style.display='none';
            e.w.style.display='block';
            e.a.textContent=H(a);
            e.p.disabled=0;
            e.c.placeholder="What's happening?";
            w.ethereum.removeEventListener('chainChanged',location.reload);
            w.ethereum.removeEventListener('accountsChanged',M);
            w.ethereum.addEventListener('chainChanged',()=>location.reload());
            w.ethereum.addEventListener('accountsChanged',M);
        }catch(e){console.warn('Wallet error:',e)}
    };

    // Initialize
    d.addEventListener('DOMContentLoaded',async()=>{
        // Event listeners setup
        ['connectWallet','publishStory','search-input','loadMoreButton'].forEach((i,x)=>{
            const el=$(i);
            if(!el)return;
            if(x<2)el.addEventListener('click',x?P:M);
            else if(x===2){
                let t;
                el.addEventListener('input',_=>{
                    clearTimeout(t);
                    t=setTimeout(()=>{
                        const v=el.value.toLowerCase();
                        R(S.n.filter(i=>H(i.reporter).toLowerCase().includes(v)||i.content.toLowerCase().includes(v)));
                    },300);
                });
            }else el.addEventListener('click',()=>F());
        });

        // Click handler
        d.addEventListener('click',e=>{
            const t=e.target;
            if(t.tagName==='BUTTON'){
                const{a,r,q,t:time}=t.dataset;
                if(a==='d')w.disputeNews?.(r,q,time);
            }
        });

        // Initialize feed
        const c=L(0,'news');
        c&&(S.n=c,R(c));
        await F(1);
    });
})();
