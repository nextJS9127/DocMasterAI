import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

export async function parseDocument(filePath: string, apiKey: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    // Enable vision models and table extraction for better accuracy as per requirements
    formData.append('parsing_instruction', 'Extract text from this document including tables and charts context.');
    formData.append('premium_mode', 'true'); // Required for vision models

    const response = await axios.post('https://api.cloud.llamaindex.ai/api/parsing/upload', formData, {
        headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
        },
    });

    const jobId = response.data.id;

    // Polling for the job result
    const maxRetries = 60; // Max 3 minutes (60 * 3s)
    let retries = 0;

    while (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        retries++;

        const statusResponse = await axios.get(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            }
        });

        const status = statusResponse.data.status;
        if (status === 'SUCCESS') {
            break;
        } else if (status === 'ERROR') {
            throw new Error('LlamaParse failed to process the document.');
        }
    }

    if (retries >= maxRetries) {
        throw new Error('LlamaParse document processing timed out after 3 minutes.');
    }

    // Retrieve the markdown result
    const resultResponse = await axios.get(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
        }
    });

    return resultResponse.data.markdown;
}
