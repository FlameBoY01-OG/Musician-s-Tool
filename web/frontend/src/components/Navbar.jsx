import { NavLink, Link } from 'react-router-dom';

function Navbar() {
  return (
    <header>
      <h1><Link to="/">Musician's Tool</Link></h1>
      <nav>
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Separate</NavLink>
        <NavLink to="/about" className={({ isActive }) => (isActive ? 'active' : '')}>About</NavLink>
      </nav>
    </header>
  );
}

export default Navbar;