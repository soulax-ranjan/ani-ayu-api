import fp from 'fastify-plugin'

async function guestMiddleware(fastify, options) {
  fastify.decorate('getGuestId', function (request, reply) {
    let guestId = request.cookies.guest_id
    if (!guestId) {
      guestId = crypto.randomUUID()
      reply.setCookie('guest_id', guestId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      })
    }
    return guestId
  })
}

export default fp(guestMiddleware)
