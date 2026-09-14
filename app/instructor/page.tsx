import { redirect } from 'next/navigation';
import InstructorDashboard from '../../components/InstructorDashboard';
import { getCurrentRole } from '../../lib/supabase/server';
export default async function Instructor(){
 const role=await getCurrentRole();
 if(role!=='instructor'&&role!=='admin') redirect('/login');
 return <main><a href="/">← Home</a><h1>Instructor Dashboard</h1><p>Authenticated review queue and transmission-level replay.</p><InstructorDashboard/></main>;
}
