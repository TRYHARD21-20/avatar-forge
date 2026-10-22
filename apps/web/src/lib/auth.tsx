import {createContext,useContext,useEffect,useState} from 'react';
import type {ReactNode,FormEvent} from 'react';
import {Link,Navigate,useLocation} from 'react-router-dom';
import {createClient} from '@supabase/supabase-js';
import type {User} from '@supabase/supabase-js';

// Only public, browser-safe credentials. NEVER use Supabase service_role here.
const URL=import.meta.env.VITE_SUPABASE_URL?.trim();
const KEY=import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const authConfigured=Boolean(URL&&KEY);
export const authClient=authConfigured?createClient(URL!,KEY!,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
}):null;
const ACTIVE='af-active-user-id';
type AuthState={user:User|null;loading:boolean;configured:boolean};
const AuthContext=createContext<AuthState>({user:null,loading:true,configured:authConfigured});
export function useAuth(){return useContext(AuthContext);}

export function AuthProvider({children}:{children:ReactNode}){
  const [state,setState]=useState<AuthState>({user:null,loading:authConfigured,configured:authConfigured});
  useEffect(()=>{
    if(!authClient)return;
    let mounted=true;
    const {data:{subscription}}=authClient.auth.onAuthStateChange((_event,session)=>{
      if(mounted)setState({user:session?.user??null,loading:false,configured:true});
    });
    void authClient.auth.getSession().then(({data})=>{
      if(mounted)setState({user:data.session?.user??null,loading:false,configured:true});
    }).catch(()=>{if(mounted)setState({user:null,loading:false,configured:true});});
    return()=>{mounted=false;subscription.unsubscribe();};
  },[]);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/** User data is scoped before the game store and capture database are imported/mounted. */
export function AccountBoundary({children}:{children:ReactNode}){
  const {user,loading,configured}=useAuth();
  const id=user?.id??'';
  const active=localStorage.getItem(ACTIVE)??'';
  const mismatch=configured&&!loading&&id!==active;
  useEffect(()=>{
    if(!mismatch)return;
    if(id)localStorage.setItem(ACTIVE,id);else localStorage.removeItem(ACTIVE);
    // Full reload reinitializes Zustand, IndexedDB, quests, and camera safely for this account.
    window.location.reload();
  },[id,mismatch]);
  if(loading||mismatch)return <div className="authLoading" role="status">Opening your photo booth…</div>;
  return <>{children}</>;
}

export function LoginRequired({children}:{children:ReactNode}){
  const {user,loading,configured}=useAuth();
  const loc=useLocation();
  // Preserve the existing guest-only game until the owner enables Supabase Auth.
  // Do not display this as an authenticated session.
  if(!configured)return <>{children}</>;
  if(loading)return <div className="authLoading" role="status">Checking your account…</div>;
  if(!user)return <Navigate to="/login" replace state={{from:loc.pathname+loc.search}}/>;
  return <>{children}</>;
}

type AuthMode='login'|'register'|'forgot';
export function AuthPage({defaultMode='login'}:{defaultMode?:AuthMode}){
  const auth=useAuth();
  const location=useLocation();
  const [mode,setMode]=useState<AuthMode>(defaultMode);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [repeat,setRepeat]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const change=(m:AuthMode)=>{setMode(m);setError('');setMessage('');setPassword('');setRepeat('');};
  const rawFrom=(location.state as {from?:string}|null)?.from;
  const destination=rawFrom?.startsWith('/')&&!rawFrom.startsWith('//')?rawFrom:'/modes';
  async function submit(ev:FormEvent<HTMLFormElement>){
    ev.preventDefault();setError('');setMessage('');
    if(!authClient){setError('Connect Supabase in Vercel first.');return;}
    if(mode!=='forgot'&&password.length<8){setError('Use a password of at least 8 characters.');return;}
    if(mode==='register'&&password!==repeat){setError('Passwords do not match.');return;}
    setBusy(true);
    try{
      if(mode==='forgot'){
        const {error}=await authClient.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/reset-password'});
        if(error)throw error;
        setMessage('If this email has an account, a password reset link will arrive shortly.');return;
      }
      const result=mode==='register'
        ?await authClient.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+'/login'}})
        :await authClient.auth.signInWithPassword({email:email.trim(),password});
      if(result.error)throw result.error;
      if(result.data.session&&result.data.user){
        localStorage.setItem(ACTIVE,result.data.user.id);
        window.location.assign(destination);
      }else setMessage('Check your inbox to verify your email, then sign in.');
    }catch(e){setError(e instanceof Error?e.message:'Could not complete authentication.');}
    finally{setBusy(false);}
  }
  if(auth.user)return <div className="authWrap"><div className="authPanel"><h1>WELCOME BACK!</h1><p>Signed in as {auth.user.email}</p><Link className="btn primary" to={destination}>Continue to the booth →</Link></div></div>;
  return <div className="authWrap"><div className="authPanel">
    <span className="eyebrow">✦ YOUR PRIVATE PHOTO BOOTH ✦</span>
    <h1>{mode==='register'?'JOIN THE FORGE':mode==='forgot'?'RESET PASSWORD':'WELCOME BACK'}</h1>
    <p>{mode==='register'?'Make an account. Facial uploads stay local and optional.':mode==='forgot'?'We will email a secure reset link.':'Sign in to play Solo, Duo and Squad.'}</p>
    {!auth.configured?<div className="authMessage" role="alert">Authentication is not configured yet. Add the public Supabase project URL and publishable/anon key to Vercel. See LOGIN_SETUP.md.</div>:<>
    {mode!=='forgot'&&<div className="authTabs"><button className={mode==='login'?'current':''} type="button" onClick={()=>change('login')}>Log in</button><button className={mode==='register'?'current':''} type="button" onClick={()=>change('register')}>Create account</button></div>}
    <form className="authForm" onSubmit={e=>void submit(e)}>
      <label>Email<input type="email" required maxLength={254} value={email} autoComplete="email" onChange={e=>setEmail(e.target.value)}/></label>
      {mode!=='forgot'&&<label>Password<input type="password" required minLength={8} maxLength={128} value={password} autoComplete={mode==='register'?'new-password':'current-password'} onChange={e=>setPassword(e.target.value)}/></label>}
      {mode==='register'&&<label>Confirm password<input type="password" required minLength={8} value={repeat} autoComplete="new-password" onChange={e=>setRepeat(e.target.value)}/></label>}
      {error&&<div className="authError" role="alert">{error}</div>}
      {message&&<div className="authMessage" role="status">{message}</div>}
      <button className="btn primary full" disabled={busy} type="submit">{busy?'Please wait…':mode==='forgot'?'Email reset link':mode==='register'?'Create account':'Log in'} →</button>
    </form>
    <div className="authLinks">{mode==='forgot'?<button onClick={()=>change('login')}>Back to login</button>:<button onClick={()=>change('forgot')}>Forgot password?</button>}</div>
    </>}
    <p className="miniNote">By continuing you still need to approve the separate game-camera consent screen. Email/password accounts are managed by Supabase Auth. We do not send face images to Supabase.</p>
    <Link to="/">← Back to home</Link>
  </div></div>;
}

export function ResetPassword(){
  const [password,setPassword]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
  async function reset(e:FormEvent){e.preventDefault();if(!authClient)return;
    if(password.length<8){setError('Use at least 8 characters.');return;}
    setBusy(true);setError('');
    try{const {error}=await authClient.auth.updateUser({password});if(error)throw error;setDone(true);}
    catch(e){setError(e instanceof Error?e.message:'Password reset failed. Open a fresh reset link.');}finally{setBusy(false);}
  }
  return <div className="authWrap"><div className="authPanel"><h1>NEW PASSWORD</h1>{done?<><p>Password updated.</p><Link className="btn primary" to="/modes">Back to playing →</Link></>:<form className="authForm" onSubmit={e=>void reset(e)}><label>New password<input type="password" minLength={8} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="authError">{error}</p>}<button className="btn primary full" disabled={busy}>{busy?'Updating…':'Update password'}</button></form>}</div></div>;
}

export async function signOut(){
  if(!authClient)return;
  const {error}=await authClient.auth.signOut();
  if(error)throw error;
  localStorage.removeItem(ACTIVE);
  window.location.assign('/login');
}
