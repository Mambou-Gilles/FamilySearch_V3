import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Your global styles

// Note: We wrap the App in AuthProvider here so that the session
// is initialized before any routes or components are rendered.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);






// import React from 'react';
// import ReactDOM from 'react-dom/client';
// import { BrowserRouter } from 'react-router-dom';
// import { AuthProvider } from './context/AuthProvider';
// import App from './App';
// import './index.css';

// ReactDOM.createRoot(document.getElementById('root')).render(
//   <React.StrictMode>
//     <BrowserRouter>
//       <AuthProvider>
//         <App />
//       </AuthProvider>
//     </BrowserRouter>
//   </React.StrictMode>
// );