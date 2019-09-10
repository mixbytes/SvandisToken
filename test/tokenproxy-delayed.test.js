const { CommonVariables, ZERO_ADDRESS, expectThrow, timetravel } = require('./helpers/common')

const { TokenProxyDelayed, SvandisBaseToken, SvandisToken, BalanceSheet, AllowanceSheet } = require('./helpers/common');

contract('TokenProxyDelayed', _accounts => {
    const commonVars = new CommonVariables(_accounts);
    const owner = commonVars.owner;
    const proxyOwner = commonVars.user;
    const user = commonVars.user2;

    // Time travel
    const ONE_HOUR = 60 * 60; // Number of seconds in one hour
    const ONE_DAY = 24 * ONE_HOUR; // Number of seconds in one day
    const ONE_WEEK = 7 * ONE_DAY; // Number of seconds in one week
    const TWO_WEEKS = 2 * ONE_WEEK; // Number of seconds in two weeks
    const FOUR_WEEKS = 4 * ONE_WEEK; // Number of seconds in four weeks

    beforeEach(async function () {
        // Empty Proxy Data storage
        this.balances = await BalanceSheet.new({ from: owner })
        this.allowances = await AllowanceSheet.new({ from: owner })
        
        // First logic contract
        this.impl_SvandisBaseToken = (await SvandisBaseToken.new(ZERO_ADDRESS, ZERO_ADDRESS, { from:owner })).address

        // Setting up Proxy initially at version 0 with data storage
        this.proxy = await TokenProxyDelayed.new(this.impl_SvandisBaseToken, this.balances.address, this.allowances.address, { from:proxyOwner })
        this.proxyAddress = this.proxy.address
    })

    describe('implementation', function () {
        const from = proxyOwner
        it('returns the Token implementation address', async function () {
            this.implementation = await this.proxy.implementation()
            assert.equal(this.implementation, this.impl_SvandisBaseToken)
        })
    })

    describe('Proxy delegates calls to SvandisBaseToken logic contract', function () {
        beforeEach(async function () {
            this.tokenProxy = SvandisBaseToken.at(this.proxyAddress)

            await this.allowances.transferOwnership(this.tokenProxy.address)
            await this.balances.transferOwnership(this.tokenProxy.address)
            await this.tokenProxy.claimBalanceOwnership()
            await this.tokenProxy.claimAllowanceOwnership()
        })
        it('tokenProxy owns data storages', async function () {
            assert.equal(await this.tokenProxy.address, await this.allowances.owner())
            assert.equal(await this.tokenProxy.address, await this.balances.owner())
        })
    //     describe('totalSupply', function () {
    //         it('returns totalSupply', async function () {
    //             const supply = await this.tokenProxy.totalSupply()
    //             assert.equal(supply, 0)
    //         })
    //     })
    //     describe('approve is enabled in SvandisBaseToken', function () {
    //         const amount = 10 * 10 ** 18
    //         it('approves user to spend for token holder', async function () {
    //             await this.tokenProxy.approve(user, amount, { from: proxyOwner })
    //             const allowance = await this.tokenProxy.allowance(proxyOwner, user)
    //             assert.equal(allowance, amount)
    //         }) 
    //     })
    })

    describe('upgradeTo SvandisToken', function () {

        beforeEach(async function () {
            // Second logic contract
            this.impl_SvandisToken = (await SvandisToken.new(ZERO_ADDRESS, ZERO_ADDRESS, { from:owner })).address
            this.tokenProxy = SvandisToken.at(this.proxyAddress)

            await this.allowances.transferOwnership(this.tokenProxy.address)
            await this.balances.transferOwnership(this.tokenProxy.address)
            await this.tokenProxy.claimBalanceOwnership()
            await this.tokenProxy.claimAllowanceOwnership()
        })
        describe('owner calls upgradeTo', function () {
            const from = proxyOwner

            beforeEach(async function () {
                const { logs } = await this.proxy.upgradeTo(this.impl_SvandisToken, { from })
                this.logs = logs
                this.event = this.logs.find(l => l.event === 'PendingImplementationChanged').event
                this.oldPending = this.logs.find(l => l.event === 'PendingImplementationChanged').args.oldPendingImplementation
                this.newPending = this.logs.find(l => l.event === 'PendingImplementationChanged').args.newPendingImplementation
            })
            it('Sets pending upgrade to SvandisToken', async function () {
                assert.equal(await this.proxy.pendingImplementation(), this.impl_SvandisToken)
                assert.equal(await this.proxy.implementation(), this.impl_SvandisBaseToken)
            })
            it('emits PendingImplementationChanged event', async function () {
                assert.equal(this.oldPending, ZERO_ADDRESS)
                assert.equal(this.newPending, this.impl_SvandisToken)
            })
            // it('upgrades to SvandisToken after enough time has passed', async function () {
                // timetravel(FOUR_WEEKS+ONE_WEEK)
                // await this.tokenProxy.totalSupply()
                // this.newImplementation = await this.proxy.implementation()
                // assert.equal(this.newImplementation, this.impl_SvandisToken)
            // })
        })
        // describe('Non-proxy-owner calls upgradeTo', function () {
        //     const from = owner
        //     it('reverts', async function () {
        //         await expectThrow(this.proxy.upgradeTo(this.impl_SvandisToken, {from}))
        //     })
        // })
        // describe('Proxy can now delegate calls to SvandisToken logic contract', function () {
        //     beforeEach(async function () {
        //         await this.proxy.upgradeTo(this.impl_SvandisToken, { from:proxyOwner })
        //         this.tokenProxy = SvandisToken.at(this.proxyAddress)
        //     })
        //     describe('proxy storages do not change', function () {
        //         it('Proxy has original balances, allowances after upgrade', async function () {
        //             assert.equal(await this.tokenProxy.balances(), this.balances.address)
        //             assert.equal(await this.tokenProxy.allowances(), this.allowances.address)
        //         })
        //     })
        //     describe('totalSupply', function () {
        //         it('returns totalSupply', async function () {
        //             const supply = await this.tokenProxy.totalSupply()
        //             assert.equal(supply, 0)
        //         })
        //     })
        //     describe('approve is disabled by default in SvandisToken', function () {
        //         const amount = 10 * 10 ** 18
        //         it('reverts', async function () {
        //             await expectThrow(this.tokenProxy.approve(user, amount, { from: proxyOwner }))
        //         }) 
        //     })
        //     describe('increaseApproval now enabled in SvandisToken', function () {
        //         const amount = 10 * 10 ** 18
        //         it('increases user allowance', async function () {
        //             await this.tokenProxy.increaseApproval(user, amount, { from: proxyOwner })
        //         }) 
        //     })
        // })
    })
})