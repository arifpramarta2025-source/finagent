import { auth } from './firebase';

/** Calls a server AI route with the signed-in owner's Firebase ID token. */
export async function postAi(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Silakan login terlebih dahulu');
  }

  const token = await user.getIdToken();
  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-Token': token,
    },
    body: JSON.stringify(body),
    signal,
  });
}
