import { useState } from 'react'

export default function JecsAdminDashboard() {
  const [stats, setStats] = useState({
    totalWashes: 1247,
    revenue: 15890.50,
    activeServices: 8,
    customerCount: 342
  })

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>JECS Quick Wash Admin Dashboard</h1>
        <p>Welcome to your admin dashboard</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Washes</h3>
          <p className="stat-value">{stats.totalWashes}</p>
        </div>
        <div className="stat-card">
          <h3>Revenue</h3>
          <p className="stat-value">${stats.revenue.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Active Services</h3>
          <p className="stat-value">{stats.activeServices}</p>
        </div>
        <div className="stat-card">
          <h3>Total Customers</h3>
          <p className="stat-value">{stats.customerCount}</p>
        </div>
      </div>

      <div className="dashboard-content">
        <section className="content-section">
          <h2>Recent Activity</h2>
          <p>Dashboard content goes here...</p>
        </section>
      </div>
    </div>
  )
}
