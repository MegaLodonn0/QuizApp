/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateQuiz = /* GraphQL */ `
  subscription OnCreateQuiz($filter: ModelSubscriptionQuizFilterInput) {
    onCreateQuiz(filter: $filter) {
      id
      name
      status
      currentQuestionID
      currentQuestionState
      currentQuestionNumber
      questions {
        nextToken
        __typename
      }
      players {
        nextToken
        __typename
      }
      isTimeBonusEnabled
      baseScore
      timeBonusScore
      answerTimeLimit
      currentQuestionStartTime
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateQuiz = /* GraphQL */ `
  subscription OnUpdateQuiz($filter: ModelSubscriptionQuizFilterInput) {
    onUpdateQuiz(filter: $filter) {
      id
      name
      status
      currentQuestionID
      currentQuestionState
      currentQuestionNumber
      questions {
        nextToken
        __typename
      }
      players {
        nextToken
        __typename
      }
      isTimeBonusEnabled
      baseScore
      timeBonusScore
      answerTimeLimit
      currentQuestionStartTime
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteQuiz = /* GraphQL */ `
  subscription OnDeleteQuiz($filter: ModelSubscriptionQuizFilterInput) {
    onDeleteQuiz(filter: $filter) {
      id
      name
      status
      currentQuestionID
      currentQuestionState
      currentQuestionNumber
      questions {
        nextToken
        __typename
      }
      players {
        nextToken
        __typename
      }
      isTimeBonusEnabled
      baseScore
      timeBonusScore
      answerTimeLimit
      currentQuestionStartTime
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateQuestion = /* GraphQL */ `
  subscription OnCreateQuestion($filter: ModelSubscriptionQuestionFilterInput) {
    onCreateQuestion(filter: $filter) {
      id
      questionText
      options
      correctAnswer
      quizID
      answers {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateQuestion = /* GraphQL */ `
  subscription OnUpdateQuestion($filter: ModelSubscriptionQuestionFilterInput) {
    onUpdateQuestion(filter: $filter) {
      id
      questionText
      options
      correctAnswer
      quizID
      answers {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteQuestion = /* GraphQL */ `
  subscription OnDeleteQuestion($filter: ModelSubscriptionQuestionFilterInput) {
    onDeleteQuestion(filter: $filter) {
      id
      questionText
      options
      correctAnswer
      quizID
      answers {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreatePlayer = /* GraphQL */ `
  subscription OnCreatePlayer($filter: ModelSubscriptionPlayerFilterInput) {
    onCreatePlayer(filter: $filter) {
      id
      nickname
      score
      quizID
      answers {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdatePlayer = /* GraphQL */ `
  subscription OnUpdatePlayer($filter: ModelSubscriptionPlayerFilterInput) {
    onUpdatePlayer(filter: $filter) {
      id
      nickname
      score
      quizID
      answers {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeletePlayer = /* GraphQL */ `
  subscription OnDeletePlayer($filter: ModelSubscriptionPlayerFilterInput) {
    onDeletePlayer(filter: $filter) {
      id
      nickname
      score
      quizID
      answers {
        nextToken
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
