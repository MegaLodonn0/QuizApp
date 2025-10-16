// src/UserPanel.js

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import * as mutations from './graphql/mutations';
import * as subscriptions from './graphql/subscriptions';
import * as queries from './graphql/queries'; // getPlayer sorgusu için bu gerekli
import { Amplify } from 'aws-amplify';
import awsExports from './aws-exports';

Amplify.configure(awsExports);
const client = generateClient();

const UserPanel = () => {
  const { quizId } = useParams();

  const [nickname, setNickname] = useState('');
  const [player, setPlayer] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // --- LİDERLİK TABLOSU FONKSİYONU (VERİMLİ VERSİYON) ---
  const fetchLeaderboard = async () => {
    try {
      const playersData = await client.graphql({
        query: queries.playersByQuizID,
        variables: { quizID: quizId, sortDirection: 'DESC' }
      });
      const sortedPlayers = playersData.data.playersByQuizID.items;
      setLeaderboard(sortedPlayers);
    } catch (e) {
      console.error("UserPanel `playersByQuizID` sorgusu BAŞARISIZ OLDU", e);
    }
  };

  const handleJoinQuiz = async (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    try {
      const playerDetails = { nickname, quizID: quizId, score: 0 };
      const newPlayerData = await client.graphql({ query: mutations.createPlayer, variables: { input: playerDetails } });
      const newPlayer = newPlayerData.data.createPlayer;
      setPlayer(newPlayer);
      localStorage.setItem(`quiz-${quizId}-player`, JSON.stringify(newPlayer));
    } catch (error) {
      console.error("Quize katılırken hata:", error);
      alert("Bu quize katılamadınız. Quiz ID'si geçerli olmayabilir veya bu isim alınmış olabilir.");
    }
  };

  // --- ANA useEffect KANCASI (GÜNCELLENMİŞ VE DOĞRULAMA EKLENMİŞ HALİ) ---
  useEffect(() => {
    // Bu fonksiyon, localStorage'daki oyuncunun veritabanında hala var olup olmadığını kontrol eder.
    const validateAndSetPlayer = async () => {
      const savedPlayerData = localStorage.getItem(`quiz-${quizId}-player`);
      if (!savedPlayerData) {
        // Eğer localStorage'da kayıt yoksa, hiçbir şey yapma. Kullanıcı isim girecek.
        return;
      }

      const savedPlayer = JSON.parse(savedPlayerData);
      
      try {
        console.log(`Doğrulanıyor: localStorage'daki oyuncu (ID: ${savedPlayer.id}) veritabanında var mı?`);
        // localStorage'dan gelen ID ile veritabanından oyuncuyu getirmeyi dene
        const response = await client.graphql({
          query: queries.getPlayer,
          variables: { id: savedPlayer.id }
        });

        if (response.data.getPlayer) {
          // BAŞARILI: Oyuncu veritabanında bulundu.
          console.log("Oyuncu geçerli. Durum ayarlanıyor.");
          setPlayer(response.data.getPlayer); // En güncel bilgiyi (örn: skor) veritabanından al
        } else {
          // BAŞARISIZ: Oyuncu veritabanında bulunamadı (silinmiş).
          console.log("Hayalet oyuncu tespit edildi. localStorage temizleniyor.");
          localStorage.removeItem(`quiz-${quizId}-player`); // Geçersiz veriyi temizle
        }
      } catch (error) {
        console.error("Oyuncu doğrulanırken bir hata oluştu:", error);
        localStorage.removeItem(`quiz-${quizId}-player`); // Hata durumunda da temizle
      }
    };

    validateAndSetPlayer(); // Sayfa yüklenir yüklenmez oyuncu doğrulamasını başlat.

    // --- Subscription ve diğer veri çekme işlemleri aynı kalabilir ---
    const fetchQuestionDetails = async (questionId) => {
      if (!questionId) {
        setCurrentQuestion(null);
        return;
      }
      try {
        const questionData = await client.graphql({ query: queries.getQuestion, variables: { id: questionId } });
        setCurrentQuestion(questionData.data.getQuestion);
      } catch (error) { console.error("Soru detayları çekilirken hata:", error); }
    };

    const sub = client.graphql({ query: subscriptions.onUpdateQuiz, variables: { filter: { id: { eq: quizId } } } })
      .subscribe({
        next: ({ data }) => {
          const updatedQuiz = data.onUpdateQuiz;
          setQuizState(updatedQuiz);
          fetchQuestionDetails(updatedQuiz.currentQuestionID);
          if (updatedQuiz.currentQuestionState === 'ASKING') {
            setHasAnswered(false);
            setSelectedOption(null);
          }
          if (updatedQuiz.currentQuestionState === 'SHOWING_LEADERBOARD') {
            fetchLeaderboard();
          }
        },
        error: (error) => console.warn(error)
      });

    const fetchInitialData = async () => {
      try {
        const quizData = await client.graphql({ query: queries.getQuiz, variables: { id: quizId } });
        const initialQuiz = quizData.data.getQuiz;
        if (initialQuiz) {
          setQuizState(initialQuiz);
          fetchQuestionDetails(initialQuiz.currentQuestionID);
          if (initialQuiz.currentQuestionState === 'SHOWING_LEADERBOARD') {
            fetchLeaderboard();
          }
        }
      } catch (e) { console.error("İlk quiz verisi çekilemedi", e); }
    }
    fetchInitialData();

    return () => sub.unsubscribe();
  }, [quizId]);

  // handleAnswerSubmit ve render fonksiyonları aynı kalır, değişiklik gerekmez.
  const handleAnswerSubmit = async (option) => {
    if (hasAnswered || !player || !currentQuestion) return;
    const optionIndex = ['A', 'B', 'C', 'D'].indexOf(option);
    if (optionIndex === -1) return;
    const selectedOptionText = currentQuestion.options[optionIndex];
    setHasAnswered(true);
    setSelectedOption(option);
    try {
      const answerDetails = { playerID: player.id, questionID: currentQuestion.id, selectedOption: selectedOptionText };
      await client.graphql({ query: mutations.createAnswer, variables: { input: answerDetails } });
    } catch (error) {
      console.error("Cevap gönderilirken hata:", error);
    }
  };

  if (!player) {
    return (
      <div style={styles.container}>
        <h1>Quize Katıl</h1>
        <form onSubmit={handleJoinQuiz} style={styles.form}>
          <input type="text" placeholder="Takma Adını Gir" value={nickname} onChange={(e) => setNickname(e.target.value)} style={styles.input} />
          <button type="submit" style={styles.button}>KATIL</button>
        </form>
      </div>
    );
  }

  const renderQuizContent = () => {
    if (!quizState || quizState.status !== 'ACTIVE' || !quizState.currentQuestionState || quizState.currentQuestionState === 'HIDDEN') {
      return <h2>Quiz'in başlaması bekleniyor...</h2>;
    }
    if (quizState.currentQuestionState === 'ASKING') {
      if (!currentQuestion) return <h2>Soru yükleniyor...</h2>;
      const options = ['A', 'B', 'C', 'D'];
      return (<div><h2>Ana Ekrandan Soruyu Okuyun ve Cevabınızı Seçin!</h2><div style={styles.optionsGrid}>{currentQuestion.options.map((opt, index) => (<button key={opt} onClick={() => handleAnswerSubmit(options[index])} disabled={hasAnswered} style={{ ...styles.optionButton, ...optionColors[index], ...(selectedOption === options[index] && styles.selectedOption) }}>{options[index]}</button>))}</div>{hasAnswered && <p>Cevabınız alındı! Lütfen bekleyin...</p>}</div>);
    }
    if (quizState.currentQuestionState === 'REVEALING_ANSWER') {
      if (!currentQuestion) return <h2>Sonuçlar Yükleniyor...</h2>;
      const correctAnswerLetter = ['A', 'B', 'C', 'D'][currentQuestion.options.indexOf(currentQuestion.correctAnswer)];
      const isCorrectSelection = selectedOption === correctAnswerLetter;
      const isUnanswered = selectedOption === null;
      return (<div><h2>Sonuçlar:</h2><div style={styles.optionsGrid}>{currentQuestion.options.map((opt, index) => { const optionLetter = ['A', 'B', 'C', 'D'][index]; let buttonStyle = { ...styles.optionButton, ...optionColors[index], transition: 'all 0.4s ease' }; const isCorrectAnswer = optionLetter === correctAnswerLetter; const isSelectedAnswer = optionLetter === selectedOption; if (isCorrectAnswer) { buttonStyle.backgroundColor = '#2ecc71'; buttonStyle.transform = 'scale(1.1)'; buttonStyle.boxShadow = '0 0 20px #2ecc71'; } else if (isSelectedAnswer) { buttonStyle.backgroundColor = '#e74c3c'; buttonStyle.transform = 'scale(0.9)'; buttonStyle.opacity = 0.7; } else { buttonStyle.backgroundColor = '#95a5a6'; buttonStyle.transform = 'scale(0.9)'; buttonStyle.opacity = 0.5; } return (<button key={opt} disabled style={buttonStyle}>{optionLetter}</button>); })}</div>{isCorrectSelection && <h3 style={{ color: '#2ecc71' }}>Doğru Cevap!</h3>}{!isUnanswered && !isCorrectSelection && <h3 style={{ color: '#e74c3c' }}>Yanlış Cevap!</h3>}{isUnanswered && <h3 style={{ color: '#f39c12' }}>Boş Bıraktınız!</h3>}</div>);
    }
    if (quizState.currentQuestionState === 'SHOWING_LEADERBOARD') {
      if (leaderboard.length === 0) return <h2>Liderlik Tablosu Yükleniyor...</h2>;
      const myRankIndex = leaderboard.findIndex(p => p.id === player.id);
      if (myRankIndex === -1) return <h2>Sıralamada bulunamadınız. Lütfen sayfayı yenileyip tekrar katılın.</h2>;
      const startIndex = Math.max(0, myRankIndex - 2);
      const endIndex = Math.min(leaderboard.length, myRankIndex + 3);
      const slicedLeaderboard = leaderboard.slice(startIndex, endIndex);
      return (<div><h2>Sıralaman</h2><p>Genel Sıralaman: {myRankIndex + 1} / {leaderboard.length}</p><div style={{ width: '100%', maxWidth: '500px' }}>{slicedLeaderboard.map((p) => { const rank = leaderboard.findIndex(item => item.id === p.id) + 1; const isMe = p.id === player.id; return (<div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', margin: '10px 0', backgroundColor: isMe ? '#f1c40f' : '#ecf0f1', color: '#2c3e50', borderRadius: '5px', transform: isMe ? 'scale(1.05)' : 'none', border: isMe ? '2px solid #2c3e50' : 'none' }}><span style={{ flex: 1, textAlign: 'left', fontWeight: 'bold' }}>#{rank}</span><span style={{ flex: 3, textAlign: 'center' }}>{p.nickname}</span><span style={{ flex: 1, textAlign: 'right', fontWeight: 'bold' }}>{p.score}</span></div>) })}</div></div>);
    }
    return <h2>Quiz bitti! Katıldığınız için teşekkürler.</h2>;
  };

  return (
    <div style={styles.container}>
      <h2>Hoş Geldin, {player.nickname}!</h2>
      {renderQuizContent()}
      <div style={{ position: 'fixed', bottom: '10px', right: '10px', fontSize: '0.8em', color: 'gray' }}>
        Oyuncu: {player.nickname}
      </div>
    </div>
  );
};

// Stiller aynı kalır
const optionColors = [{ backgroundColor: 'rgb(231, 76, 60)' }, { backgroundColor: 'rgb(52, 152, 219)' }, { backgroundColor: 'rgb(241, 196, 15)' }, { backgroundColor: 'rgb(46, 204, 113)' }];
const styles = {
  container: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', height: '100vh', padding: '20px', fontFamily: 'sans-serif' },
  form: { display: 'flex', flexDirection: 'column', width: '80%', maxWidth: '300px' },
  input: { padding: '15px', fontSize: '1.2em', marginBottom: '10px', textAlign: 'center' },
  button: { padding: '15px', fontSize: '1.2em', backgroundColor: '#2ecc71', color: 'white', border: 'none', cursor: 'pointer' },
  optionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', maxWidth: '500px', marginTop: '20px' },
  optionButton: { padding: '40px 20px', fontSize: '2.5em', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
  selectedOption: { border: '5px solid white', transform: 'scale(1.05)' }
};

export default UserPanel;