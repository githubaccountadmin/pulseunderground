const C={
    n:'PUCache',
    v:1,
    s:{n:'news',c:'comments',r:'reporters'},
    t:3e5,
    k:{c:'cached',t:'timestamp',q:'queryId',r:'reporter'}
};

class P{
    constructor(){
        this.d=null;
        this.m=new Map;
        this.p=new Set;
        this._={};
        this.i=this.init()
    }

    async init(){
        if(this.d)return this.d;
        return new Promise((r,j)=>{
            const q=indexedDB.open(C.n,C.v);
            q.onerror=()=>j(q.error);
            q.onsuccess=()=>{this.d=q.result;r(this.d)};
            q.onupgradeneeded=e=>{
                const d=e.target.result,
                      k=C.k;
                if(!d.objectStoreNames.contains(C.s.n)){
                    const s=d.createObjectStore(C.s.n,{keyPath:k.q});
                    s.createIndex(k.t,k.t,{unique:false});
                    s.createIndex(k.r,k.r,{unique:false})
                }
                if(!d.objectStoreNames.contains(C.s.c)){
                    const s=d.createObjectStore(C.s.c,{keyPath:[k.q,k.t]});
                    s.createIndex(k.q,k.q,{unique:false});
                    s.createIndex(k.t,k.t,{unique:false})
                }
                if(!d.objectStoreNames.contains(C.s.r)){
                    const s=d.createObjectStore(C.s.r,{keyPath:'address'});
                    s.createIndex('lastActive','lastActive',{unique:false})
                }
            }
        })
    }

    async tx(s,m,f){
        const d=await this.i,
              t=d.transaction(s,m),
              o=t.objectStore(s);
        try{
            return await f(o,t)
        }catch(e){
            t.abort();
            throw e
        }
    }

    async sn(i){
        const t=Date.now(),
              b=[];
        await this.tx(C.s.n,'readwrite',(s)=>{
            for(const x of i)b.push(s.put({...x,[C.k.c]:t}));
            return Promise.all(b)
        })
    }

    async gn(o={}){
        const{l=50,f=0,r}=o,
              n=Date.now()-C.t,
              i=[];
        return this.tx(C.s.n,'readonly',async(s)=>{
            const x=r?s.index(C.k.r):s.index(C.k.t),
                  c=await new Promise((v,j)=>{
                      let a=0;
                      x.openCursor(r||null,'prev').onsuccess=e=>{
                          const c=e.target.result;
                          if(!c||i.length>=l){v();return}
                          if(a<f){a++;c.continue();return}
                          if(c.value[C.k.c]>n)i.push(c.value);
                          c.continue()
                      }
                  });
            return i
        })
    }

    async sc(q,c){
        const t=Date.now(),
              b=[];
        await this.tx(C.s.c,'readwrite',(s)=>{
            for(const x of c)b.push(s.put({...x,[C.k.q]:q,[C.k.c]:t}));
            return Promise.all(b)
        })
    }

    async gc(q){
        const n=Date.now()-C.t;
        return this.tx(C.s.c,'readonly',async(s)=>{
            const r=await new Promise((v,j)=>{
                s.index(C.k.q).getAll(q).onsuccess=e=>{
                    v(e.target.result
                        .filter(x=>x[C.k.c]>n)
                        .sort((a,b)=>b[C.k.t]-a[C.k.t]))
                }
            });
            return r
        })
    }

    sm(k,v){
        this.m.set(k,{v,t:Date.now()})
    }

    gm(k){
        const e=this.m.get(k);
        if(!e)return null;
        if(Date.now()-e.t>C.t){
            this.m.delete(k);
            return null
        }
        return e.v
    }

    async cc(){
        this.m.clear();
        const d=await this.i;
        await Promise.all(Array.from(d.objectStoreNames).map(n=>
            this.tx(n,'readwrite',s=>s.clear())
        ))
    }

    async ce(){
        const d=await this.i,
              n=Date.now()-C.t;
        for(const s of d.objectStoreNames){
            this.tx(s,'readwrite',o=>{
                o.index(C.k.t).openCursor().onsuccess=e=>{
                    const c=e.target.result;
                    if(c){
                        if(c.value[C.k.c]<n)c.delete();
                        c.continue()
                    }
                }
            })
        }
    }

    async dr(k,f){
        if(this.p.has(k))return new Promise(r=>{
            setTimeout(async()=>{r(await this.dr(k,f))},100)
        });
        try{
            this.p.add(k);
            return await f()
        }finally{
            this.p.delete(k)
        }
    }
}

// Initialize and export
window.PUCache=new P;

// Auto cleanup
setInterval(()=>window.PUCache.ce().catch(console.error),C.t);
