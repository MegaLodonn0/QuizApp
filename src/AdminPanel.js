// src/AdminPanel.js

import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import * as mutations from './graphql/mutations';
import * as queries from './graphql/queries';
import { Amplify } from 'aws-amplify';
import awsExports from './aws-exports';

Amplify.configure(awsExports);
const client = generateClient();

const AdminPanel = () => {
  // --- STATE TANIMLAMALARI ---
  const [quizzes, setQuizzes] = useState([]);
  const [newQuizName, setNewQuizName] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  const [quizSettings, setQuizSettings] = useState({
    isTimeBonusEnabled: false,
    baseScore: 30,
    timeBonusScore: 30,
    answerTimeLimit: 30, // <-- GÜNCELLENDİ
  });

  
  // --- FONKSİYONLAR ---

  const handleCreateQuiz = async (event) => {
    event.preventDefault();
    if (!newQuizName.trim()) return;
  
    const quizDetails = { 
      name: newQuizName, 
      status: 'PENDING',
      ...quizSettings,
      // Şema'daki default değerlere sahip zorunlu alanlar için başlangıç değerleri
      currentQuestionState: 'HIDDEN',
      currentQuestionNumber: 0,
    };
  
    try {
      await client.graphql({
        query: mutations.createQuiz,
        variables: { input: quizDetails }
      });
      setNewQuizName('');
      // Formu varsayılan ayarlara sıfırla
      setQuizSettings({
        isTimeBonusEnabled: false,
        baseScore: 30,
        timeBonusScore: 30,
        answerTimeLimit: 30, // <-- GÜNCELLENDİ
      });
      fetchQuizzes();
      alert(`"${newQuizName}" oluşturuldu!`);
    } catch (error) {
      console.error("Quiz oluşturulurken hata:", error);
    }
  };

  // Diğer tüm fonksiyonlar aynı kalabilir...
  // handleResetQuiz, handleUpdateQuizStatus, fetchQuizzes, fetchQuestions, etc.
  
  const handleResetQuiz = async (quiz) => {
    try {
      const input = { 
        id: quiz.id, 
        status: 'PENDING',
        currentQuestionID: null,
        currentQuestionState: 'HIDDEN',
        currentQuestionNumber: 0
      };
      await client.graphql({ query: mutations.updateQuiz, variables: { input } });

      const playersResponse = await client.graphql({ query: queries.listPlayers });
      const allPlayers = playersResponse.data.listPlayers.items;
      const playersToDelete = allPlayers.filter(p => p.quizID === quiz.id);

      for (const player of playersToDelete) {
        await client.graphql({
          query: mutations.deletePlayer,
          variables: { input: { id: player.id } }
        });
      }

      alert(`"${quiz.name}" quizi sıfırlandı ve tüm oyuncu verileri silindi!`);
      
      const updatedQuizzes = quizzes.map(q => q.id === quiz.id ? { ...q, ...input } : q);
      setQuizzes(updatedQuizzes);
      setSelectedQuiz(prev => ({ ...prev, ...input }));

    } catch (error) {
      console.error("Quiz sıfırlanırken hata:", error);
    }
  };

  const handleUpdateQuizStatus = async (quiz, newStatus) => {
    if (quiz.status === 'FINISHED' && newStatus === 'PENDING') {
      handleResetQuiz(quiz);
      return;
    }

    try {
      const input = { id: quiz.id, status: newStatus };
      await client.graphql({ query: mutations.updateQuiz, variables: { input } });

      if (newStatus === 'ACTIVE') {
        window.open(`/sunum/${quiz.id}`, '_blank', 'noopener,noreferrer');
      }

      const updatedQuizzes = quizzes.map(q => (q.id === quiz.id ? { ...q, status: newStatus } : q));
      setQuizzes(updatedQuizzes);
      setSelectedQuiz({ ...quiz, status: newStatus });

    } catch (error) {
      console.error("Quiz durumu güncellenirken hata:", error);
    }
  };

  const fetchQuizzes = async () => {
    try {
      const apiData = await client.graphql({ query: queries.listQuizzes });
      setQuizzes(apiData.data.listQuizzes.items);
    } catch (error) {
      console.error("Quizler çekilirken hata oluştu:", error);
    }
  };
  
  const fetchQuestions = async (quizId) => {
    if (!quizId) return;
    setIsLoadingQuestions(true);
    try {
      const apiData = await client.graphql({ query: queries.listQuestions });
      const filtered = apiData.data.listQuestions.items.filter(q => q.quizID === quizId);
      setQuestions(filtered);
    } catch (error) {
      console.error("Sorular çekilirken hata oluştu:", error);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  useEffect(() => { fetchQuizzes(); }, []);
  
  useEffect(() => {
    if (selectedQuiz) {
      fetchQuestions(selectedQuiz.id);
    } else {
      setQuestions([]);
    }
  }, [selectedQuiz]);

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmitQuestion = async (event) => {
    event.preventDefault();
    if (!questionText || options.some(opt => opt === '') || !correctAnswer) return;
    const details = { questionText, options, correctAnswer, quizID: selectedQuiz.id };
    try {
      await client.graphql({ query: mutations.createQuestion, variables: { input: details } });
      alert('Soru eklendi!');
      fetchQuestions(selectedQuiz.id);
      setQuestionText('');
      setOptions(['', '', '', '']);
      setCorrectAnswer('');
    } catch (error) {
      console.error('Soru oluşturulurken hata:', error);
    }
  };

  const handleStepChange = async (direction) => {
    if (!selectedQuiz || !questions.length) return;
  
    const currentState = selectedQuiz.currentQuestionState || 'HIDDEN';
    const currentNumber = selectedQuiz.currentQuestionNumber || 0;
    
    let nextState = currentState;
    let nextQuestionNumber = currentNumber;
    let nextQuestionID = selectedQuiz.currentQuestionID;
  
    const sortedQuestions = [...questions].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    if (direction === 'forward') {
      if (currentState === 'HIDDEN' || currentState === 'SHOWING_LEADERBOARD') {
        nextState = 'ASKING';
        nextQuestionNumber = currentNumber + 1;
        const nextQuestion = sortedQuestions[nextQuestionNumber - 1];
        if (!nextQuestion) {
          alert("Quiz bitti!");
          handleUpdateQuizStatus(selectedQuiz, 'FINISHED');
          return;
        }
        nextQuestionID = nextQuestion.id;
      } else if (currentState === 'ASKING') {
        nextState = 'REVEALING_ANSWER';
      } else if (currentState === 'REVEALING_ANSWER') {
        nextState = 'SHOWING_LEADERBOARD';
      }
    } else if (direction === 'backward') {
      if (currentState === 'SHOWING_LEADERBOARD') {
        nextState = 'REVEALING_ANSWER';
      } else if (currentState === 'REVEALING_ANSWER') {
        nextState = 'ASKING';
      } else if (currentState === 'ASKING') {
        if (currentNumber <= 1) {
          nextState = 'HIDDEN';
          nextQuestionNumber = 0;
          nextQuestionID = null;
        } else {
          nextState = 'SHOWING_LEADERBOARD';
          nextQuestionNumber = currentNumber - 1;
          nextQuestionID = sortedQuestions[nextQuestionNumber - 1].id;
        }
      }
    }
  
    try {
      const input = { id: selectedQuiz.id, currentQuestionState: nextState, currentQuestionNumber: nextQuestionNumber, currentQuestionID: nextQuestionID };
      await client.graphql({ query: mutations.updateQuiz, variables: { input } });
      setSelectedQuiz(prev => ({ ...prev, ...input }));
    } catch (error) {
      console.error("Quiz adımı değiştirilirken hata:", error);
    }
  };

  // --- ARAYÜZ (RENDER) ---
  return (
    <div style={{ margin: '20px', padding: '20px', border: '1px solid #ccc', fontFamily: 'sans-serif' }}>
      <h1>Admin Paneli</h1>

      <section style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #eee' }}>
        <h2>Quiz Yönetimi</h2>
        <form onSubmit={handleCreateQuiz} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <input
                type="text"
                placeholder="Yeni Quiz Adı Girin"
                value={newQuizName}
                onChange={(e) => setNewQuizName(e.target.value)}
                style={{ padding: '10px', minWidth: '300px', flex: 1 }}
                />
                <button type="submit" style={{ padding: '10px 20px' }}>Oluştur</button>
            </div>

            <div style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '15px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                    <input 
                        type="checkbox" 
                        id="timeBonus" 
                        checked={quizSettings.isTimeBonusEnabled} 
                        onChange={e => setQuizSettings(prev => ({...prev, isTimeBonusEnabled: e.target.checked}))}
                    />
                    <label htmlFor="timeBonus" style={{ marginLeft: '5px' }}>Zaman Bonusu Aktif</label>
                </div>
                <div>
                    <label htmlFor="baseScore">Taban Puan: </label>
                    <input 
                        type="number" 
                        id="baseScore" 
                        value={quizSettings.baseScore} 
                        onChange={e => setQuizSettings(prev => ({...prev, baseScore: parseInt(e.target.value, 10) || 0}))} 
                        style={{ width: '60px', padding: '5px' }} 
                    />
                </div>
                <div>
                    <label htmlFor="timeBonusScore">Maks. Zaman Puanı: </label>
                    <input 
                        type="number" 
                        id="timeBonusScore" 
                        value={quizSettings.timeBonusScore} 
                        onChange={e => setQuizSettings(prev => ({...prev, timeBonusScore: parseInt(e.target.value, 10) || 0}))} 
                        style={{ width: '60px', padding: '5px' }} 
                    />
                </div>
                 {/* YENİ EKLENEN INPUT */}
                <div>
                    <label htmlFor="answerTimeLimit">Cevap Süresi (sn): </label>
                    <input 
                        type="number" 
                        id="answerTimeLimit" 
                        value={quizSettings.answerTimeLimit} 
                        onChange={e => setQuizSettings(prev => ({...prev, answerTimeLimit: parseInt(e.target.value, 10) || 0}))} 
                        style={{ width: '60px', padding: '5px' }} 
                    />
                </div>
            </div>
        </form>
        <div>
          <h3>Düzenlemek İçin Bir Quiz Seçin:</h3>
          {quizzes.map(quiz => (
            <button key={quiz.id} onClick={() => setSelectedQuiz(quiz)} style={{ padding: '10px', margin: '5px', border: selectedQuiz?.id === quiz.id ? '2px solid blue' : '1px solid gray', backgroundColor: selectedQuiz?.id === quiz.id ? '#e0f7ff' : 'white', cursor: 'pointer' }}>
              {quiz.name}
            </button>
          ))}
        </div>
      </section>

      {selectedQuiz && (
        <section>
          <h2>"{selectedQuiz.name}" Quizi İçin Yönetim</h2>
          
            <div style={{ padding: '15px', backgroundColor: '#f0f0f0', border: '1px solid #ccc', marginBottom: '20px', borderRadius: '5px' }}>
              <h4>Quiz Durumu: <strong style={{ color: selectedQuiz.status === 'ACTIVE' ? 'green' : 'orange' }}>{selectedQuiz.status}</strong></h4>
              {selectedQuiz.status === 'PENDING' && <button onClick={() => handleUpdateQuizStatus(selectedQuiz, 'ACTIVE')} style={{ padding: '10px', backgroundColor: 'green', color: 'white' }}>Quizi Başlat</button>}
              {selectedQuiz.status === 'ACTIVE' && <button onClick={() => handleUpdateQuizStatus(selectedQuiz, 'FINISHED')} style={{ padding: '10px', backgroundColor: 'red', color: 'white' }}>Quizi Bitir</button>}
              {selectedQuiz.status === 'FINISHED' && <button onClick={() => handleUpdateQuizStatus(selectedQuiz, 'PENDING')} style={{ padding: '10px', backgroundColor: 'gray', color: 'white' }}>Quizi Sıfırla ve Beklemeye Al</button>}
              <p style={{ fontSize: '0.8em', color: '#666', marginTop: '10px', marginBottom: '0' }}>
                Quiz ID: {selectedQuiz.id}
              </p>
            </div>

            {selectedQuiz.status === 'ACTIVE' && (
                <div style={{ padding: '15px', backgroundColor: '#e0f7ff', border: '1px solid #007bff', marginTop: '10px', borderRadius: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button onClick={() => handleStepChange('backward')} style={{ padding: '15px 30px', fontSize: '18px' }}>← GERİ</button>
                        <div style={{textAlign: 'center'}}>
                            <h4>Canlı Kontrol</h4>
                            <p>Mevcut Aşama: <strong>{selectedQuiz.currentQuestionState || 'HIDDEN'}</strong></p>
                            <p>Soru Numarası: <strong>{selectedQuiz.currentQuestionNumber || 0} / {questions.length}</strong></p>
                        </div>
                        <button onClick={() => handleStepChange('forward')} style={{ padding: '15px 30px', fontSize: '18px' }} disabled={isLoadingQuestions}>{isLoadingQuestions ? 'Yükleniyor...' : 'İLERİ →'}</button>
                    </div>
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #007bff' }}>
                        <h5 style={{margin: '0 0 10px 0'}}>Paylaşım Linkleri:</h5>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <a href={`/sunum/${selectedQuiz.id}`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px', border: '1px solid #007bff', borderRadius: '5px', textDecoration: 'none' }}>
                                Sunum Ekranını Aç
                            </a>
                            <a href={`/join/${selectedQuiz.id}`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px', border: '1px solid #007bff', borderRadius: '5px', textDecoration: 'none' }}>
                                Katılım Sayfasını Aç
                            </a>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmitQuestion} style={{ marginTop: '30px', padding: '20px', background: '#f9f9f9', borderRadius: '5px' }}>
                <h3>Yeni Soru Ekle</h3>
                <div><label>Soru Metni:</label><input type="text" value={questionText} onChange={(e) => setQuestionText(e.target.value)} style={{ width: 'calc(100% - 20px)', padding: '8px', margin: '10px 0' }}/></div>
                <div><label>Şıklar:</label>{options.map((option, index) => (<input key={index} type="text" placeholder={`Şık ${index + 1}`} value={option} onChange={(e) => handleOptionChange(index, e.target.value)} style={{ display: 'block', width: 'calc(100% - 20px)', padding: '8px', margin: '5px 0' }}/>))}</div>
                <div style={{ marginTop: '10px' }}><label>Doğru Cevabı İşaretleyin:</label>{options.map((option, index) => (option && (<div key={index}><input type="radio" id={`option-radio-${index}`} name="correctAnswer" value={option} checked={correctAnswer === option} onChange={(e) => setCorrectAnswer(e.target.value)}/><label htmlFor={`option-radio-${index}`}>{option}</label></div>)))}</div>
                <button type="submit" style={{ marginTop: '20px', padding: '10px 20px' }}>Bu Quize Soruyu Ekle</button>
            </form>

            <div>
                <h3>Eklenen Sorular</h3>
                {questions.length > 0 ? (questions.map((question) => (<div key={question.id} style={{ padding: '15px', border: '1px solid #ddd', marginBottom: '10px', borderRadius: '5px' }}><p style={{ margin: '0 0 10px 0' }}><strong>Soru: {question.questionText}</strong></p><ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{question.options.map((option, index) => (<li key={index} style={{ padding: '5px', backgroundColor: option === question.correctAnswer ? '#d4edda' : 'transparent', borderRadius: '3px' }}>{option}</li>))}</ul></div>))) : (<p>Bu quiz için henüz soru eklenmemiş.</p>)}
            </div>
        </section>
      )}
    </div>
  );
};

export default AdminPanel;