
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import InventoryPage from "./pages/InventoryPage";
import { AuthPage } from "./pages/Auth";
import { ResetPasswordPage } from "./pages/ResetPassword";
import { SharedShoppingListPage } from "./pages/SharedShoppingList";
import GeminiLivePage from "./pages/GeminiLivePage";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import ImageScanPage from "./pages/ImageScanPage";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            {/* Protected */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
            <Route path="/gemini-live" element={<ProtectedRoute><GeminiLivePage /></ProtectedRoute>} />
            <Route path="/image-scan" element={<ProtectedRoute><ImageScanPage /></ProtectedRoute>} />
            <Route path="/shared/:shareToken" element={<SharedShoppingListPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
