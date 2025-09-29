import { useState, useEffect } from 'react'
import './App.css'
import axios from 'axios'

function App() {
  const [message, setMessage] = useState('')
  const [insertedId, setInsertedId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Ping the server when the component mounts
    axios.get('/ping')
      .then(response => {
        setMessage('Server is online: ' + response.data)
      })
      .catch(err => {
        setError('Error connecting to server: ' + err.message)
      })
  }, [])

  const handleAddData = async () => {
    try {
      setError(null)
      const response = await axios.post('/add_data')
      if (response.data.ok) {
        setInsertedId(response.data.inserted_id)
        setMessage('Data added successfully!')
      } else {
        setError('Failed to add data: ' + response.data.error)
      }
    } catch (err) {
      setError('Error: ' + err.message)
    }
  }

  return (
    <div className="container">
      <h1>Capstone React App</h1>
      
      <div className="card">
        <h2>Server Status</h2>
        {message && <p className="message">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <button onClick={handleAddData}>
          Add Data to Database
        </button>
        {insertedId !== null && (
          <p>Successfully added data with ID: {insertedId}</p>
        )}
      </div>

      <div className="footer">
        <p>
          Built with React + Vite
        </p>
      </div>
    </div>
  )
}

export default App