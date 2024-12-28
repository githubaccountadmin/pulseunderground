const { defaultAbiCoder, utils } = window.ethers;

window.data = {
    ps: async function() {
        const c = this._('reportContent').value.trim();
        if (!c) return this.t('Please enter content');
        this._('publishStory').disabled = true, this.g(1);
        try {
            if (!this.contract) throw new Error("Wallet not connected.");
            const d = defaultAbiCoder.encode(['string', 'bytes'], ["StringQuery", utils.toUtf8Bytes(c)]),
                  i = utils.keccak256(d),
                  n = await this.contract.getNewValueCountbyQueryId(i),
                  v = defaultAbiCoder.encode(['string', 'bytes'], ["NEWS", utils.toUtf8Bytes(c)]);
            const stakerInfo = await this.contract.getStakerInfo(await this.signer.getAddress()),
                  requiredStake = await this.contract.getStakeAmount(),
                  userStake = stakerInfo[1];
            if (userStake.lt(requiredStake)) throw new Error(`Not enough TRB staked. You have ${utils.formatEther(userStake)} vs ${utils.formatEther(requiredStake)} TRB needed.`);
            let g = await this.contract.estimateGas.submitValue(i, v, n, d);
            if (g.gt(utils.constants.MaxUint256.div(100))) throw new Error("Gas estimate too high.");
            g = g.mul(110).div(100);
            const t = await this.contract.submitValue(i, v, n, d, { gasLimit: g });
            await t.wait(), this.t('Story published!'), this._('reportContent').value = '';
            const s = { content: c, reporter: await this.signer.getAddress(), timestamp: new Date().toISOString(), queryId: i };
            this.s.i.unshift(s), this.r([s], true), await this.cache.sn([s]);
        } catch (e) {
            console.error('Publish error:', e);
            this.t(e.message.includes('insufficient funds') ? 'Insufficient funds' :
                 e.message.includes('gas required') ? 'Gas estimate too high' :
                 e.message.includes('Not enough TRB') ? e.message :
                 'Error publishing: '+e.message);
        } finally {
            this._('publishStory').disabled = false, this.g(0);
        }
    },
    se: function() {
        const i = this._('search-input'), v = i?.value.trim().toLowerCase();
        if (!v) return;
        const f = this.s.i.filter(x => this.sh(x.reporter).toLowerCase().includes(v) || x.content.toLowerCase().includes(v));
        this.r(f), this.s.a = 1, this._('loadMoreButton').style.display = 'block', this.t(`Found ${f.length} result(s)`);
    },
    c: async function() {
        if (this.s.l || Date.now() - this.s.t < 3e4) return;
        this.s.l = 1, this.g(1);
        try {
            const r = await this.tx(this.s.p), n = await this.p(r), u = n.filter(x => !this.s.i.some(y => y.queryId === x.queryId));
            u.length && (this.s.i.unshift(...u), this.r(u, 1), this.t('+' + u.length), await this.cache.sn(u));
            this.s.t = Date.now();
        } catch (e) {
            console.error('Update error:', e);
        } finally {
            this.s.l = 0, this.g(0);
        }
    },
    f: async function(x) {
        if (this.s.l || this.s.n && !x) return;
        this.s.l = 1, this.g(1);
        if (x) {
            this.s.i = [], this.s.n = 0, this.s.p = null;
        }
        try {
            const n = [], cachedItems = await this.cache.gn({ l: D.m });
            if (cachedItems.length) {
                this.s.i = cachedItems, this.r(cachedItems, !x);
            }
            while (n.length < D.m && !this.s.n) {
                const r = await this.tx(this.s.p), i = await this.p(r);
                n.push(...i);
            }
            n.length && (await this.cache.sn(n), this.s.i = x ? n : this.s.i.concat(n), this.r(n, !x));
            this._('loadMoreButton').style.display = this.s.n ? 'none' : 'block';
        } catch (e) {
            console.error('Feed error:', e);
        } finally {
            this.s.l = 0, this.g(0);
        }
    },
    p: async function(b) {
        if (!b?.items?.length) {
            this.s.n = 1;
            return [];
        }
        const i = [];
        for (const t of b.items) if (t.method === 'submitValue' && t.decoded_input?.parameters?.length >= 4) {
            const [y, b] = defaultAbiCoder.decode(['string', 'bytes'], t.decoded_input.parameters[3].value);
            if (y === 'StringQuery') {
                const c = utils.toUtf8String(b).trim();
                c && i.push({ content: c, reporter: t.from.hash || t.from, timestamp: t.timestamp || t.block_timestamp, queryId: t.decoded_input.parameters[0].value });
            }
        }
        this.s.p = b.next_page_params || null;
        this.s.n = !this.s.p;
        return i;
    },
    r: function(i, a) {
        if (!i.length && !a) return this._('newsFeed').innerHTML = 'No items';
        const f = document.createDocumentFragment(), t = document.createElement('template');
        i.forEach(m => {
            t.innerHTML = `<article class="news-item"><div class="reporter-info"><img src="newTRBphoto.jpg" alt="R" class="avatar"><div class="reporter-details"><span class="reporter-name">${this.sh(m.reporter)}</span>· ${this.dt(m.timestamp)}</div></div><div class="report-content">${m.content.split('\n\n').map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('')}</div><div class="report-actions"data-reporter="${m.reporter}"data-query-id="${m.queryId}"data-timestamp="${m.timestamp}"><button class="action-btn"data-action="comment">💬</button><button class="action-btn"data-action="like">👍</button><button class="action-btn"data-action="dispute">⚠️</button><button class="action-btn"data-action="vote">✓</button></div></article>`;
            f.appendChild(t.content.firstChild);
        });
        const n = this._('newsFeed');
        a ? n.appendChild(f) : (n.textContent = '', n.appendChild(f)), n.style.visibility = 'visible';
    }
};
