// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminPanel from './AdminPanel';
import UserPanel from './UserPanel';
import QuizScreen from './QuizScreen';
import './App.css';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/join/:quizId" element={<UserPanel />} />
                <Route path="/sunum/:quizId" element={<QuizScreen />} />
                <Route path="/" element={<h1>Quiz App Ana Sayfa</h1>} />
                <Route path="/" element={<h1>Quiz App Ana Sayfa</h1>} />
            </Routes>
        </Router>
    );
}

export default App;