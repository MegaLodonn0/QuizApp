// amplify/backend/function/YOUR_FUNCTION_NAME/src/index.js

const { DynamoDB } = require('aws-sdk');
const https = require('https');
const AWS = require('aws-sdk');
const url = require('url');

// Lambda'nın, projenizdeki diğer dosyalara erişimi olmadığı için,
// kullanacağı sorgu ve mutasyonları doğrudan burada tanımlamak daha güvenilir olabilir.
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

// Bu helper fonksiyon, Lambda'dan AppSync'e imzalı GraphQL istekleri yapmamızı sağlar.
const callGraphQL = async (query, variables) => {
  const endpoint = new url.URL(process.env.API_QUIZAPP_GRAPHQLAPIENDPOINTOUTPUT); // 'quizapp' yerine kendi API adınızı yazın
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

// Puan hesaplama mantığını içeren yeni yardımcı fonksiyon
const calculateScore = (isCorrect, quiz, newAnswer) => {
  if (!isCorrect) {
    return 0;
  }

  let awardedScore = quiz.baseScore || 10; // Varsayılan taban puan

  // Zaman bonusu etkinse ve gerekli veriler mevcutsa bonusu hesapla
  if (quiz.isTimeBonusEnabled && quiz.currentQuestionStartTime && newAnswer.createdAt) {
    const answerTime = new Date(newAnswer.createdAt);
    const questionStartTime = new Date(quiz.currentQuestionStartTime);
    const timeDiffSeconds = (answerTime - questionStartTime) / 1000;

    // Cevap süresi, belirlenen limit içindeyse bonusu uygula
    if (timeDiffSeconds >= 0 && timeDiffSeconds < quiz.answerTimeLimit) {
      const timeBonus = quiz.timeBonusScore * (1 - (timeDiffSeconds / quiz.answerTimeLimit));
      awardedScore += Math.round(timeBonus);
    }
  }

  return awardedScore;
};

exports.handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);

  for (const record of event.Records) {
    if (record.eventName === 'INSERT') {
      const newAnswer = DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

      try {
        console.log('Yeni cevap alındı:', newAnswer);

        const [questionData, playerData] = await Promise.all([
          callGraphQL(getQuestion, { id: newAnswer.questionID }),
          callGraphQL(getPlayer, { id: newAnswer.playerID })
        ]);
        
        const question = questionData.data.getQuestion;
        const player = playerData.data.getPlayer;

        if (!question || !player) {
          console.error('Soru veya Oyuncu bulunamadı!', { question, player });
          continue;
        }

        // `options` alanı olmadan gelen eski sorularla uyumluluk için kontrol
        if (!question.options || !Array.isArray(question.options)) {
            console.error('Soruda `options` alanı bulunamadı veya dizi değil.', question);
            continue;
        }

        const quizData = await callGraphQL(getQuiz, { id: question.quizID });
        const quiz = quizData.data.getQuiz;
        if (!quiz) {
            console.error('Quiz bulunamadı!');
            continue;
        }

        // Cevabın doğruluğunu metin yerine indekse göre kontrol et
        const correctOptionIndex = question.options.indexOf(question.correctAnswer);
        const selectedOptionIndex = question.options.indexOf(newAnswer.selectedOption);

        const isCorrect = correctOptionIndex !== -1 && correctOptionIndex === selectedOptionIndex;

        const awardedScore = calculateScore(isCorrect, quiz, newAnswer);

        console.log(`Hesaplanan Puan: ${awardedScore}, Doğru mu: ${isCorrect}`);

        // Sadece puan kazanıldıysa oyuncuyu güncelle
        if (awardedScore > 0) {
            const newTotalScore = player.score + awardedScore;
            const updatePlayerInput = { id: player.id, score: newTotalScore };
            const updateResult = await callGraphQL(updatePlayer, { input: updatePlayerInput });
            console.log('Oyuncu başarıyla güncellendi:', updateResult.data.updatePlayer);
        }

      } catch (error) {
        console.error('Puanlama sırasında hata:', error);
      }
    }
  }
  return Promise.resolve('Successfully processed DynamoDB record');
};