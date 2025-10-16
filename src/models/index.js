// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';

const QuizStatus = {
  "PENDING": "PENDING",
  "ACTIVE": "ACTIVE",
  "FINISHED": "FINISHED"
};

const { Quiz, Question, Player, Answer } = initSchema(schema);

export {
  Quiz,
  Question,
  Player,
  Answer,
  QuizStatus
};