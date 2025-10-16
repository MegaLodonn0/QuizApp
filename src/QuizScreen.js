// src/QuizScreen.js

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import * as subscriptions from './graphql/subscriptions';
import * as queries from './graphql/queries';
import { Amplify } from 'aws-amplify';
import awsExports from './aws-exports';

Amplify.configure(awsExports);
const client = generateClient();

const QuizScreen = () => {
  const { quizId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // --- YENİ VE VERİMLİ LİDERLİK TABLOSU FONKSİYONU ---
  const fetchLeaderboard = async () => {
    try {
      console.log("QUIZSCREEN: Verimli `playersByQuizID` sorgusu deneniyor...");

      // Sadece bu quiz'e ait oyuncuları, puana göre sıralanmış olarak çekiyoruz.
      const playersData = await client.graphql({
        query: queries.playersByQuizID, // Otomatik üretilen özel sorgu
        variables: {
          quizID: quizId,
          sortDirection: 'DESC', // Puana göre azalan sıralama (en yüksek üstte)
          limit: 5 // Sunum ekranında sadece ilk 5'i göstermek yeterli
        }
      });

      const top5Players = playersData.data.playersByQuizID.items;

      console.log("QUIZSCREEN: Veritabanından gelen en iyi 5 oyuncu:", top5Players);
      setLeaderboard(top5Players);

    } catch(e) {
      console.error("QuizScreen `playersByQuizID` sorgusu BAŞARISIZ OLDU", e);
    }
  };

  useEffect(() => {
    const fetchInitialQuizData = async () => {
      try {
        const quizData = await client.graphql({ query: queries.getQuiz, variables: { id: quizId } });
        const initialQuiz = quizData.data.getQuiz;
        setQuiz(initialQuiz);
        // Eğer başlangıçta liderlik tablosu gösteriliyorsa veriyi çek
        if (initialQuiz && initialQuiz.currentQuestionState === 'SHOWING_LEADERBOARD') {
          fetchLeaderboard();
        }
      } catch (error) {
        console.error("Quiz verisi çekilirken hata:", error);
      }
    };
    fetchInitialQuizData();

    // Quiz güncellemelerini dinle
    const sub = client.graphql({ query: subscriptions.onUpdateQuiz, variables: { filter: { id: { eq: quizId } } } })
        .subscribe({
          next: ({ data }) => {
            setQuiz(data.onUpdateQuiz);
          },
          error: (error) => console.warn(error)
        });

    return () => sub.unsubscribe();
  }, [quizId]);


  useEffect(() => {
    // Quiz durumu değiştikçe gerekli verileri çek
    if (quiz && quiz.currentQuestionID) {
      const fetchQuestionDetails = async () => {
        try {
          const questionData = await client.graphql({ query: queries.getQuestion, variables: { id: quiz.currentQuestionID } });
          setCurrentQuestion(questionData.data.getQuestion);
        } catch (error) {
          console.error("Soru detayları çekilirken hata:", error);
        }
      };
      fetchQuestionDetails();
    } else {
      setCurrentQuestion(null);
    }

    // Liderlik tablosu aşamasına gelindiğinde veriyi yenile
    if (quiz && quiz.currentQuestionState === 'SHOWING_LEADERBOARD') {
      fetchLeaderboard();
    }
  }, [quiz]);

  const renderContent = () => {
    if (!quiz) {
      return <h2>Yükleniyor...</h2>;
    }

    switch (quiz.currentQuestionState) {
      case 'ASKING':
        if (!currentQuestion) return <h2>Soru Yükleniyor...</h2>;
        return (
            <div>
              <h1>{currentQuestion.questionText}</h1>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '2em', marginTop: '40px' }}>
                {currentQuestion.options.map((opt, index) => (
                    <div key={opt} style={{ padding: '20px', backgroundColor: `rgb(${[ '231, 76, 60', '52, 152, 219', '241, 196, 15', '46, 204, 113'][index]})`, color: 'white', borderRadius: '5px' }}>
                      {opt}
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