const { createLogger } = require('../utils/logger');
const logger = createLogger('RequestInterceptor');

/**
 * NetworkInterceptor - Handles network request interception for data capture
 */
class NetworkInterceptor {
  constructor(page, storage, persona, graphqlHandler) {
    this.page = page;
    this.storage = storage;
    this.persona = persona;
    this.graphqlHandler = graphqlHandler;
  }

  /**
   * Set up network request interception using fetchOverride.js logic
   * This intercepts fetch and XHR responses to extract reel data
   */
  setup() {
    // Store reference to this for use in exposed function
    const interceptorInstance = this;
    
    // Expose function for browser context to send intercepted data back to Node.js
    this.page.exposeFunction('sendDataToNode', async (interceptedData) => {
      try {
        const { url, method, data, contentType } = interceptedData;
        
        // Fire and forget - save raw packets asynchronously to prevent blocking
        if (interceptorInstance.storage && data) {
          setImmediate(() => {
            try {
              interceptorInstance.storage.saveRawInterceptedPacket(
                interceptorInstance.persona,
                url,
                method,
                contentType,
                data
              );
            } catch (saveError) {
              logger.debug(`Failed to save intercepted packet: ${saveError.message}`);
            }
          });
        }
        
        logger.debug(`Intercepted: ${method} ${url.substring(0, 100)}...`);
        
        // Check if this is a GraphQL request with reel data
        if (url.includes('/graphql/query') && method === 'POST') {
          try {
            // Handle responses that start with "for (;;);" prefix (common Instagram pattern)
            let cleanData = typeof data === 'string' ? data : JSON.stringify(data);
            if (cleanData.startsWith('for (;;);')) {
              cleanData = cleanData.replace(/^for \(;;\);\s*/, '');
            }
            
            const parsedData = typeof cleanData === 'string' ? JSON.parse(cleanData) : cleanData;
            
            if (!parsedData || !parsedData.data) {
              return; // Not a valid GraphQL response
            }
            
            // Process GraphQL response for reel data
            if (interceptorInstance.graphqlHandler) {
              interceptorInstance.graphqlHandler.processGraphQLResponse(parsedData, url, method);
            }
          } catch (error) {
            // Only log non-JSON parsing errors to reduce noise
            if (!error.message.includes('Unexpected token') && 
                !error.message.includes('JSON') &&
                !error.message.includes('parse')) {
              logger.debug(`GraphQL response parsing error: ${error.message}`);
            }
          }
        }
      } catch (error) {
        logger.debug(`Error processing intercepted data: ${error.message}`);
        return;
      }
    });

    // Inject fetchOverride.js logic using evaluateOnNewDocument
    this.page.evaluateOnNewDocument(() => {
      try {
        // Override window.fetch
        const originalFetch = window.fetch;
        window.fetch = new Proxy(originalFetch, {
          apply: async function(target, thisArg, argumentsList) {
            try {
              const [url, options] = argumentsList;
              const response = await target.apply(thisArg, argumentsList);
              
              // Clone response only if it hasn't been consumed
              let responseClone;
              try {
                responseClone = response.clone();
              } catch (cloneError) {
                return response;
              }
              
              const urlString = typeof url === 'string' ? url : url.url;
              const method = options?.method || 'GET';
              
              // Fire and forget - don't block on interception
              Promise.resolve().then(async () => {
                try {
                  const contentType = responseClone.headers.get('content-type');
                  const data = await responseClone.text();
                  
                  if (window.sendDataToNode) {
                    window.sendDataToNode({
                      url: urlString,
                      method: method,
                      data: data,
                      contentType: contentType
                    }).catch(() => {});
                  }
                } catch (err) {}
              }).catch(() => {});
              
              return response;
            } catch (err) {
              return await target.apply(thisArg, argumentsList);
            }
          }
        });
      } catch (error) {
        console.error('Failed to inject fetch override:', error);
      }

      // Override XMLHttpRequest
      try {
        const OrigXMLHttpRequest = window.XMLHttpRequest;
        window.XMLHttpRequest = new Proxy(OrigXMLHttpRequest, {
          construct: function(target, args) {
            try {
              const xhr = new target(...args);
              
              xhr.open = new Proxy(xhr.open, {
                apply: function(target, thisArg, argsList) {
                  try {
                    xhr._method = argsList[0];
                    xhr._url = argsList[1];
                    return target.apply(thisArg, argsList);
                  } catch (err) {
                    return target.apply(thisArg, argsList);
                  }
                }
              });
              
              xhr.send = new Proxy(xhr.send, {
                apply: function(target, thisArg, argsList) {
                  try {
                    const originalOnload = xhr.onload;
                    xhr.onload = function() {
                      try {
                        if (originalOnload) {
                          originalOnload.apply(this, arguments);
                        }
                        
                        Promise.resolve().then(() => {
                          try {
                            const contentType = xhr.getResponseHeader('content-type');
                            let responseData;
                            if (xhr.responseType === '' || xhr.responseType === 'text') {
                              responseData = xhr.responseText;
                            } else if (xhr.responseType === 'json') {
                              responseData = JSON.stringify(xhr.response);
                            } else {
                              responseData = '[non-text response]';
                            }
                            
                            const urlString = typeof xhr._url === 'object' ? xhr._url.toString() : xhr._url;
                            
                            if (window.sendDataToNode) {
                              window.sendDataToNode({
                                url: urlString,
                                method: xhr._method || 'GET',
                                data: responseData,
                                contentType: contentType
                              }).catch(() => {});
                            }
                          } catch (err) {}
                        }).catch(() => {});
                      } catch (err) {}
                    };
                    
                    return target.apply(thisArg, argsList);
                  } catch (err) {
                    return target.apply(thisArg, argsList);
                  }
                }
              });
              
              return xhr;
            } catch (err) {
              return new target(...args);
            }
          }
        });
      } catch (error) {
        console.error('Failed to inject XHR override:', error);
      }
    });
    
    logger.debug('Network interception initialized using fetchOverride.js logic');
  }
}

module.exports = NetworkInterceptor;

