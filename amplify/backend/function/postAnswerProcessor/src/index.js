// amplify/backend/function/postAnswerProcessor/src/index.js

const { DynamoDB } = require('aws-sdk');
const https = require('https');
const AWS = require('aws-sdk');
const url = require('url');

// --- GraphQL Sorguları ve Mutasyonları ---
const getQuestion = /* GraphQL */ `
  query GetQuestion($id: ID!) {
    getQuestion(id: $id) { id questionText correctAnswer quizID options }
  }
`;
const getQuiz = /* GraphQL */ `
  query GetQuiz($id: ID!) {
    getQuiz(id: $id) { id isTimeBonusEnabled baseScore timeBonusScore answerTimeLimit currentQuestionStartTime }
  }
`;
const getPlayer = /* GraphQL */ `
  query GetPlayer($id: ID!) {
    getPlayer(id: $id) { id score }
  }
`;
const updatePlayer = /* GraphQL */ `
  mutation UpdatePlayer($input: UpdatePlayerInput!) {
    updatePlayer(input: $input) { id nickname score }
  }
`;

// --- Yardımcı Fonksiyonlar ---

/**
 * AppSync'e imzalı GraphQL istekleri yapar.
 */
const callGraphQL = async (query, variables) => {
  const endpoint = new url.URL(process.env.API_QUIZAPP_GRAPHQLAPIENDPOINTOUTPUT);
  const req = new AWS.HttpRequest(endpoint, process.env.AWS_REGION);
  
  req.method = 'POST';
  req.path = '/graphql';
  req.headers.host = endpoint.host;
  req.headers['Content-Type'] = 'application/json';
  req.body = JSON.stringify({ query, variables });

  const signer = new AWS.Signers.V4(req, 'appsync', true);
  signer.addAuthorization(AWS.config.credentials, AWS.util.date.getDate());

  return new Promise((resolve, reject) => {
    const httpRequest = https.request({ ...req, host: endpoint.host }, (result) => {
      let data = '';
      result.on('data', (chunk) => { data += chunk; });
      result.on('end', () => { resolve(JSON.parse(data)); });
    });
    httpRequest.on('error', reject);
    httpRequest.write(req.body);
    httpRequest.end();
  });
};

/**
 * Gelen cevaba göre ilgili Question, Player ve Quiz verilerini çeker.
 */
const fetchRequiredData = async (newAnswer) => {
    const [questionData, playerData] = await Promise.all([
        callGraphQL(getQuestion, { id: newAnswer.questionID }),
        callGraphQL(getPlayer, { id: newAnswer.playerID })
    ]);

    const question = questionData.data.getQuestion;
    const player = playerData.data.getPlayer;

    if (!question || !player) {
        throw new Error(`Soru veya Oyuncu bulunamadı! Question: ${question}, Player: ${player}`);
    }

    if (!question.options || !Array.isArray(question.options)) {
        throw new Error(`Soruda 'options' alanı bulunamadı veya dizi değil: ${question}`);
    }

    const quizData = await callGraphQL(getQuiz, { id: question.quizID });
    const quiz = quizData.data.getQuiz;

    if (!quiz) {
        throw new Error(`Quiz bulunamadı! QuizID: ${question.quizID}`);
    }

    return { question, player, quiz };
};


/**
 * Cevabın doğruluğuna ve zamanlamasına göre puanı hesaplar.
 */
const calculateScore = (isCorrect, quiz, newAnswer) => {
    if (!isCorrect) {
        return 0;
    }

    let awardedScore = quiz.baseScore || 10;

    if (quiz.isTimeBonusEnabled && quiz.currentQuestionStartTime && newAnswer.createdAt) {
        const answerTime = new Date(newAnswer.createdAt);
        const questionStartTime = new Date(quiz.currentQuestionStartTime);
        const timeDiffSeconds = (answerTime - questionStartTime) / 1000;

        if (timeDiffSeconds >= 0 && timeDiffSeconds < quiz.answerTimeLimit) {
            const timeBonus = quiz.timeBonusScore * (1 - (timeDiffSeconds / quiz.answerTimeLimit));
            awardedScore += Math.round(timeBonus);
        }
    }
    return awardedScore;
};

/**
 * Oyuncunun toplam skorunu günceller.
 */
const updatePlayerScore = async (player, awardedScore) => {
    const newTotalScore = player.score + awardedScore;
    const updatePlayerInput = { id: player.id, score: newTotalScore };
    const updateResult = await callGraphQL(updatePlayer, { input: updatePlayerInput });
    console.log('Oyuncu başarıyla güncellendi:', updateResult.data.updatePlayer);
};


// --- Ana Lambda Handler ---

exports.handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);

  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') {
      continue;
    }

    const newAnswer = DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

    try {
      console.log('Yeni cevap alındı:', newAnswer);

      // 1. Gerekli verileri çek
      const { question, player, quiz } = await fetchRequiredData(newAnswer);

      // 2. Cevabın doğruluğunu kontrol et
      const correctOptionIndex = question.options.indexOf(question.correctAnswer);
      const selectedOptionIndex = question.options.indexOf(newAnswer.selectedOption);
      const isCorrect = correctOptionIndex !== -1 && correctOptionIndex === selectedOptionIndex;

      // 3. Puanı hesapla
      const awardedScore = calculateScore(isCorrect, quiz, newAnswer);
      console.log(`Hesaplanan Puan: ${awardedScore}, Doğru mu: ${isCorrect}`);

      // 4. Gerekliyse oyuncunun skorunu güncelle
      if (awardedScore > 0) {
        await updatePlayerScore(player, awardedScore);
      }

    } catch (error) {
      console.error('Puanlama sırasında bir hata oluştu:', error.message);
    }
  }
  return Promise.resolve('Successfully processed DynamoDB record');
};