const dialog = document.querySelector('#auth-dialog');
const form = document.querySelector('#auth-form');
let mode = 'login';
let user = null;
function setMode(next) {
  mode = next;
  form.reset();
  form.password.type = 'password';
  document.querySelector('#toggle-password').textContent = 'Show';
  const signup = mode === 'register';
  document.querySelector('#auth-title').textContent = signup ? 'A fresh start.' : 'Welcome back.';
  document.querySelector('#auth-description').textContent = signup ? 'Make a little room for your next chapter.' : 'A little focus looks good on you.';
  document.querySelector('#name-field').hidden = !signup;
  form.elements.name.required = signup;
  form.password.autocomplete = signup ? 'new-password' : 'current-password';
  document.querySelector('#password-hint').hidden = !signup;
  document.querySelector('.submit').textContent = signup ? 'Create account ↗' : 'Log in ↗';
  document.querySelector('#switch-label').textContent = signup ? 'Already have an account?' : 'New here?';
  document.querySelector('#switch-mode').textContent = signup ? 'Log in' : 'Create an account';
  document.querySelector('#form-message').textContent = '';
}
function renderAccount() {
  document.querySelector('#auth-content').hidden = !!user;
  document.querySelector('#account-content').hidden = !user;
  document.querySelector('#welcome-name').textContent = user ? `Hello, ${user.name}.` : '';
  document.querySelector('#account-email').textContent = user?.email || '';
  document.querySelector('.nav [data-auth]').textContent = user ? 'Your space ↗' : 'Log in ↗';
}
async function api(path, body) {
  const response = await fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
document.querySelectorAll('[data-auth]').forEach(button => button.addEventListener('click', () => { setMode(button.dataset.auth); renderAccount(); dialog.showModal(); }));
document.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
document.querySelector('#switch-mode').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
document.querySelector('#toggle-password').addEventListener('click', event => { const show = form.password.type === 'password'; form.password.type = show ? 'text' : 'password'; event.target.textContent = show ? 'Hide' : 'Show'; event.target.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  document.querySelector('#form-message').textContent = '';
  try { const data = await api(mode, Object.fromEntries(new FormData(form))); user = data.user; form.reset(); renderAccount(); }
  catch (error) { document.querySelector('#form-message').textContent = error instanceof TypeError ? 'Start the local server to use login. See the README for instructions.' : error.message; }
  finally { button.disabled = false; }
});
document.querySelector('#logout').addEventListener('click', async () => { try { await api('logout', {}); user = null; renderAccount(); setMode('login'); } catch { document.querySelector('#account-message').textContent = 'Could not log out. Please try again.'; } });
api('me').then(data => { user = data.user; renderAccount(); }).catch(() => {});
