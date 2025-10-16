// src/DataTest.js

import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import * as queries from './graphql/queries';
import awsExports from './aws-exports';

Amplify.configure(awsExports);
const client = generateClient();

const DataTest = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState({
        quizzes: [],
        players: [],
        questions: [],
        answers: []
    });

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                console.log("--- TEST BAŞLADI: Tüm veriler çekiliyor... ---");

                // 1. Quizzes
                const quizzesData = await client.graphql({ query: queries.listQuizzes });
                console.log("✅ Quizzes verisi:", quizzesData);
                const quizzes = quizzesData.data.listQuizzes.items;

                // 2. Players
                const playersData = await client.graphql({ query: queries.listPlayers });
                console.log("✅ Players verisi:", playersData);
                const players = playersData.data.listPlayers.items;

                // 3. Questions
                const questionsData = await client.graphql({ query: queries.listQuestions });
                console.log("✅ Questions verisi:", questionsData);
                const questions = questionsData.data.listQuestions.items;

                // 4. Answers
                const answersData = await client.graphql({ query: queries.listAnswers });
                console.log("✅ Answers verisi:", answersData);
                const answers = answersData.data.listAnswers.items;

                setData({ quizzes, players, questions, answers });
                console.log("--- TEST BAŞARIYLA BİTTİ ---");

            } catch (err) {
                console.error("--- 🛑 TEST BAŞARISIZ OLDU ---");
                console.error("Hata detayları:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, []);

    if (loading) {
        return <h1 style={{ fontFamily: 'sans-serif', padding: '20px' }}>Veritabanı Test Ediliyor... Lütfen Bekleyin...</h1>;
    }

    if (error) {
        return (
            <div style={{ fontFamily: 'sans-serif', padding: '20px', color: 'red' }}>
                <h1>🛑 Test Sırasında Hata Oluştu</h1>
                <p>Lütfen tarayıcı konsolunu kontrol edin.</p>
                <pre>{JSON.stringify(error, null, 2)}</pre>
            </div>
        );
    }

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
            <h1>📊 Veritabanı Test Sonuçları</h1>
            <p>Eğer bir listenin altında "Veri bulunamadı" yazıyorsa, o tabloda hiç kayıt olmayabilir. Eğer bir hata olsaydı, yukarıda kırmızı bir hata mesajı görürdünüz.</p>

            <section>
                <h2>Quizzes ({data.quizzes.length} adet)</h2>
                {data.quizzes.length > 0 ? (
                    data.quizzes.map(q => <pre key={q.id}>{JSON.stringify(q, null, 2)}</pre>)
                ) : <p>Veri bulunamadı.</p>}
            </section>

            <hr />

            <section>
                <h2>Players ({data.players.length} adet)</h2>
                {data.players.length > 0 ? (
                    data.players.map(p => <pre key={p.id}>{JSON.stringify(p, null, 2)}</pre>)
                ) : <p>Veri bulunamadı.</p>}
            </section>

            <hr />

            <section>
                <h2>Questions ({data.questions.length} adet)</h2>
                {data.questions.length > 0 ? (
                    data.questions.map(q => <pre key={q.id}>{JSON.stringify(q, null, 2)}</pre>)
                ) : <p>Veri bulunamadı.</p>}
            </section>

            <hr />

            <section>
                <h2>Answers ({data.answers.length} adet)</h2>
                {data.answers.length > 0 ? (
                    data.answers.map(a => <pre key={a.id}>{JSON.stringify(a, null, 2)}</pre>)
                ) : <p>Veri bulunamadı.</p>}
            </section>
        </div>
    );
};

export default DataTest;