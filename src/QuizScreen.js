// src/QuizScreen.js

import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuizData } from './hooks/useQuizData'; // Yeni hook'u import et

const QuizScreen = () => {
  const { quizId } = useParams();
  // Veri çekme ve state yönetimini hook'a devret
  const { quizState: quiz, currentQuestion, leaderboard, loading, error } = useQuizData(quizId);

  const renderContent = () => {
    if (loading) return <h2>Yükleniyor...</h2>;
    if (error) return <h2>Bir hata oluştu. Lütfen sayfayı yenileyin.</h2>;
    if (!quiz) return <h2>Quiz bulunamadı veya yükleniyor...</h2>;

    switch (quiz.currentQuestionState) {
      case 'ASKING':
        if (!currentQuestion) return <h2>Soru Yükleniyor...</h2>;
        return (
            <div>
              <h1>{currentQuestion.questionText}</h1>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '2em', marginTop: '40px' }}>
                {currentQuestion.options.map((opt, index) => (
                    <div key={opt} style={{ padding: '20px', backgroundColor: `rgb(${[ '231, 76, 60', '52, 152, 219', '241, 196, 15', '46, 204, 113'][index]})`, color: 'white', borderRadius: '5px' }}>
                      {`${String.fromCharCode(65 + index)}. ${opt}`}
                    </div>
                ))}
              </div>
            </div>
        );
      case 'REVEALING_ANSWER':
        if (!currentQuestion) return <h2>Cevap Yükleniyor...</h2>;
        return (
            <div>
              <h1>{currentQuestion.questionText}</h1>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '2em', marginTop: '40px' }}>
                {currentQuestion.options.map((opt) => (
                    <div
                        key={opt}
                        style={{
                          padding: '20px',
                          color: 'white',
                          borderRadius: '5px',
                          transition: 'all 0.4s ease',
                          backgroundColor: opt === currentQuestion.correctAnswer ? '#2ecc71' : '#95a5a6',
                          transform: opt === currentQuestion.correctAnswer ? 'scale(1.1)' : 'scale(0.9)',
                          opacity: opt === currentQuestion.correctAnswer ? 1 : 0.7,
                          boxShadow: opt === currentQuestion.correctAnswer ? '0 0 20px #2ecc71' : 'none'
                        }}
                    >
                      {opt}
                    </div>
                ))}
              </div>
            </div>
        );
      case 'SHOWING_LEADERBOARD':
        return (
            <div>
              <h1>Liderlik Tablosu</h1>
              <div style={{ width: '80%', maxWidth: '900px', marginTop: '40px' }}>
                {leaderboard.length === 0 && <p>Skorlar Hesaplanıyor...</p>}
                {leaderboard.map((player, index) => (
                    <div key={player.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '20px',
                      margin: '10px 0',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      fontSize: '1.8em',
                      fontWeight: 'bold'
                    }}>
                      <span style={{flex: 1, textAlign: 'left', color: '#f1c40f'}}>#{index + 1}</span>
                      <span style={{flex: 4, textAlign: 'center'}}>{player.nickname}</span>
                      <span style={{flex: 1, textAlign: 'right'}}>{player.score}</span>
                    </div>
                ))}
              </div>
            </div>
        );
      default:
        return (
            <div>
              <h1>"{quiz.name}" Başlamak Üzere!</h1>
              <h2>Lütfen Telefonlarınızdan Hazır Olun!</h2>
            </div>
        );
    }
  };

  return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#2c3e50', color: 'white', textAlign: 'center', padding: '50px' }}>
        {renderContent()}
        <div style={{ position: 'fixed', bottom: '10px', right: '10px', fontSize: '0.8em', color: 'rgba(255, 255, 255, 0.5)' }}>
          Quiz ID: {quizId}
        </div>
      </div>
  );
};

export default QuizScreen;