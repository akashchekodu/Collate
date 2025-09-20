import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function generateJWT(peerId, documentId, permissions = ['read', 'write'], expiryHours = 24) {
  const payload = {
    peerId,
    documentId,
    permissions,
    exp: Math.floor(Date.now() / 1000) + (expiryHours * 60 * 60),
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET);
}

// CLI usage
if (process.argv.length > 2) {
  const peerId = process.argv[2] || 'test-peer';
  const documentId = process.argv[3] || 'test-document';
  const token = generateJWT(peerId, documentId);
  console.log('Generated JWT Token:');
  console.log(token);
  console.log('\nDecoded payload:');
  console.log(jwt.decode(token));
}

export { generateJWT };
