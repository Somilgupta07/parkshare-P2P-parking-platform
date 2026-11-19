import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();
  return (
    <section>
      <h1>Find parking, or earn from your space</h1>
      <p className="muted">Search and listing pages are added by the other team members. Hello{user?.name ? `, ${user.name}` : ''}!</p>
    </section>
  );
}
