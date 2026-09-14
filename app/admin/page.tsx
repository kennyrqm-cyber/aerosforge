import { redirect } from 'next/navigation';
import { getCurrentRole } from '../../lib/supabase/server';
export default async function Admin(){
 const role=await getCurrentRole();
 if(role!=='admin') redirect('/login');
 return <main><a href="/">← Home</a><h1>Admin Dashboard</h1><div className="grid"><section className="card"><h2>Scenario Registry</h2><p>Versioned scenarios, approval status, and CFI reviewer assignment.</p></section><section className="card"><h2>Audit & Certificates</h2><p>Immutable events, issuance/revocation, and verification records.</p></section><section className="card"><h2>Compliance</h2><p>WINGS-alignment evidence only until acceptance is independently verified.</p></section></div></main>;
}
