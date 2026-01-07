// src/App.tsx
import { AuthProvider } from "@/contexts/AuthContext";
import useRouterElements from "@/routes/elements";

function App() {
  try {
    return (
      <AuthProvider>
        {useRouterElements()}
      </AuthProvider>
    );
  } catch (error) {
    console.error('App render error:', error);
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Lỗi khi tải ứng dụng</h1>
        <p>{String(error)}</p>
      </div>
    );
  }
}

export default App;
