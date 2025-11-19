// src/App.tsx
import { AuthProvider } from "@/contexts/AuthContext";
import useRouterElements from "@/routes/elements";

function App() {
  return (
    <AuthProvider>
      {useRouterElements()}
    </AuthProvider>
  );
}

export default App;
