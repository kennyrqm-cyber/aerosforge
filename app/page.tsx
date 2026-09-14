const links = [
  ['/practice','Student Practice'],['/instructor','Instructor Dashboard'],['/admin','Admin Dashboard']
];
export default function Home(){return <main>
  <h1>AeroComm Master</h1><p>Cross-device aviation radio communications training MVP.</p>
  <div className="grid">{links.map(([href,label])=><a className="card" href={href} key={href}><h2>{label}</h2><p className="small">Open module →</p></a>)}</div>
  <p className="small" style={{marginTop:24}}>MVP status: local implementation starter. No FAA approval, deployment, or WINGS credit is represented by this build.</p>
</main>}
