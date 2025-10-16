import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import * as subscriptions from '../graphql/subscriptions';
import * as queries from '../graphql/queries';
import { Amplify } from 'aws-amplify';
import awsExports from '../aws-exports';

Amplify.configure(awsExports);
const client = generateClient();

export const useQuizData = (quizId) => {
    const [quizState, setQuizState] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!quizId) return;

        const fetchLeaderboard = async () => {
            try {
                const playersData = await client.graphql({
                    query: queries.playersByQuizID,
                    variables: { quizID: quizId, sortDirection: 'DESC' }
                });
                setLeaderboard(playersData.data.playersByQuizID.items);
            } catch (e) {
                console.error("useQuizData `playersByQuizID` sorgusu BAŞARISIZ OLDU", e);
            }
        };

        const fetchQuestionDetails = async (questionId) => {
            if (!questionId) {
                setCurrentQuestion(null);
                return;
            }
            try {
                const questionData = await client.graphql({ query: queries.getQuestion, variables: { id: questionId } });
                setCurrentQuestion(questionData.data.getQuestion);
            } catch (err) {
                console.error("Soru detayları çekilirken hata:", err);
            }
        };

        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const quizData = await client.graphql({ query: queries.getQuiz, variables: { id: quizId } });
                const initialQuiz = quizData.data.getQuiz;
                if (initialQuiz) {
                    setQuizState(initialQuiz);
                    await fetchQuestionDetails(initialQuiz.currentQuestionID);
                    if (initialQuiz.currentQuestionState === 'SHOWING_LEADERBOARD') {
                        await fetchLeaderboard();
                    }
                }
            } catch (e) {
                console.error("İlk quiz verisi çekilemedi", e);
                setError(e);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();

        const sub = client.graphql({ query: subscriptions.onUpdateQuiz, variables: { filter: { id: { eq: quizId } } } })
            .subscribe({
                next: ({ data }) => {
                    const updatedQuiz = data.onUpdateQuiz;
                    setQuizState(updatedQuiz);
                    fetchQuestionDetails(updatedQuiz.currentQuestionID);
                    if (updatedQuiz.currentQuestionState === 'ASKING') {
                        // Cevap durumunu sıfırlama mantığı bileşenin kendisine ait olmalı
                    }
                    if (updatedQuiz.currentQuestionState === 'SHOWING_LEADERBOARD') {
                        fetchLeaderboard();
                    }
                },
                error: (err) => {
                    console.warn(err);
                    setError(err);
                }
            });

        return () => sub.unsubscribe();
    }, [quizId]);

    return { quizState, currentQuestion, leaderboard, loading, error };
};