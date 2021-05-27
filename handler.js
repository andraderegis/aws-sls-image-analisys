'use strict';

const { get } = require('axios');

class Handler {
  constructor({ rekognitionService, translatorService }) {
    this.rekognitionService = rekognitionService;
    this.translatorService = translatorService;
  }

  async detectImageLabels(buffer) {
    const result = await this.rekognitionService.detectLabels({
      Image: {
        Bytes: buffer
      }
    }).promise();

    const workingItems = result.Labels
      .filter(({ Confidence }) => Confidence > 80);

    const names = workingItems
      .map(({ Name }) => Name)
      .join(' and ');

    return { names, workingItems };
  }

  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data, 'base64');
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text
    }

    const { TranslatedText } = await this.translatorService
      .translateText(params)
      .promise();

    return TranslatedText.split(' e ');
  }

  formatTranslatedText({ texts, workingItems }) {
    const finalFormatedText = [];

    for (const indexText in texts) {
      const nameInPortuguese = texts[indexText];
      const confidence = workingItems[indexText].Confidence;

      finalFormatedText.push(`${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`);
    }

    return finalFormatedText.join('\n');
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters;

      const imageBuffer = await this.getImageBuffer(imageUrl)

      const { names, workingItems } = await this.detectImageLabels(imageBuffer);

      const translatedText = await this.translateText(names);

      const formatedTranslatedText = this.formatTranslatedText({
        texts: translatedText,
        workingItems
      });

      return {
        statusCode: 200,
        body: `A imagem tem \n`.concat(formatedTranslatedText)
      }
    } catch (error) {
      console.log('Error****', error.stack);

      return {
        statusCode: 500,
        body: 'Internal server error!'
      }
    }
  }
}

//factory
const aws = require('aws-sdk');

const rekognition = new aws.Rekognition();
const translator = new aws.Translate();

const handler = new Handler({
  rekognitionService: rekognition,
  translatorService: translator
});


module.exports.main = handler.main.bind(handler);
