import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/navigation/NavBar'; 
import Footer from '../components/navigation/Footer';

export default function PublicLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}