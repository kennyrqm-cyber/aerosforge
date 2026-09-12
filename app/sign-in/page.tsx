import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
export default function SignInPage(){return <main><AuthForm mode="sign-in"/><p style={{textAlign:"center"}} className="muted">New here? <Link className="gold" href="/sign-up">Create an account</Link></p></main>;}
