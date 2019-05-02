// @ts-check
require('../helper')
const expect = require('expect')
const { HTML5History } = require('../../src/history/html5')
const { Router } = require('../../src/router')
const fakePromise = require('faked-promise')
const { NAVIGATION_TYPES, createDom } = require('../utils')

/**
 * @param {Partial<import('../../src/router').RouterOptions> & { routes: import('../../src/types').RouteRecord[]}} options
 */
function createRouter(options) {
  return new Router({
    history: new HTML5History(),
    ...options,
  })
}

const Home = { template: `<div>Home</div>` }
const Foo = { template: `<div>Foo</div>` }

const beforeRouteUpdate = jest.fn()
/** @type {import('../../src/types').RouteRecord[]} */
const routes = [
  { path: '/', component: Home },
  { path: '/foo', component: Foo },
  {
    path: '/guard/:go',
    component: {
      ...Foo,
      beforeRouteUpdate,
    },
  },
]

beforeEach(() => {
  beforeRouteUpdate.mockReset()
})

describe('beforeRouteUpdate', () => {
  beforeAll(() => {
    createDom()
  })

  NAVIGATION_TYPES.forEach(navigationMethod => {
    describe(navigationMethod, () => {
      it('calls beforeRouteUpdate guards when changing params', async () => {
        const router = createRouter({ routes })
        beforeRouteUpdate.mockImplementationOnce((to, from, next) => {
          next()
        })
        await router[navigationMethod]('/guard/valid')
        // not called on initial navigation
        expect(beforeRouteUpdate).not.toHaveBeenCalled()
        await router[navigationMethod]('/guard/other')
        expect(beforeRouteUpdate).toHaveBeenCalledTimes(1)
      })

      it('resolves async components before guarding', async () => {
        const spy = jest.fn((to, from, next) => next())
        const component = {
          template: `<div></div>`,
          beforeRouteUpdate: spy,
        }
        const router = createRouter({
          routes: [
            ...routes,
            { path: '/async/:a', component: () => Promise.resolve(component) },
          ],
        })
        await router[navigationMethod]('/async/a')
        expect(spy).not.toHaveBeenCalled()
        await router[navigationMethod]('/async/b')
        expect(spy).toHaveBeenCalledTimes(1)
      })

      it('waits before navigating', async () => {
        const [promise, resolve] = fakePromise()
        const router = createRouter({ routes })
        beforeRouteUpdate.mockImplementationOnce(async (to, from, next) => {
          await promise
          next()
        })
        await router[navigationMethod]('/guard/one')
        const p = router[navigationMethod]('/guard/foo')
        expect(router.currentRoute.fullPath).toBe('/guard/one')
        resolve()
        await p
        expect(router.currentRoute.fullPath).toBe('/guard/foo')
      })
    })
  })
})
