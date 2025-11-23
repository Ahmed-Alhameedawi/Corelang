/**
 * HTTP Effect Handler
 *
 * Handles HTTP operations (get, post, put, delete).
 */

import { Value, ValueFactory, ValueTypeChecker } from '../vm/value.js';
import { Principal } from '../vm/vm.js';
import { EffectHandler, EffectMetadata } from './registry.js';

/**
 * HTTP response
 */
interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * HTTP effect handler
 */
export class HttpEffectHandler implements EffectHandler {
  name = 'http';

  // Mock HTTP responses for testing
  private mockResponses: Map<string, HttpResponse> = new Map();

  /**
   * Execute HTTP operation
   */
  async execute(
    operation: string,
    params: Value[],
    principal: Principal,
    metadata: EffectMetadata
  ): Promise<Value> {
    switch (operation) {
      case 'get':
        return this.get(params, principal);

      case 'post':
        return this.post(params, principal);

      case 'put':
        return this.put(params, principal);

      case 'delete':
        return this.delete(params, principal);

      case 'call':
        return this.call(params, principal);

      default:
        throw new Error(`Unknown HTTP operation: ${operation}`);
    }
  }

  /**
   * Check permission
   */
  checkPermission(operation: string, principal: Principal): boolean {
    // Simple permission check - allow all HTTP operations for principals with 'admin' or 'http' roles
    return (
      principal.roles.includes('admin') ||
      principal.roles.includes('http.call') ||
      principal.roles.includes('viewer')
    );
  }

  /**
   * HTTP GET
   */
  private async get(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 1) {
      return ValueFactory.err(ValueFactory.string('http.get requires a URL'));
    }

    const url = params[0];

    if (!ValueTypeChecker.isString(url)) {
      return ValueFactory.err(ValueFactory.string('URL must be a string'));
    }

    // Mock HTTP GET - in production, this would use fetch() or axios
    const response = this.mockGet(url.value);

    return this.responseToValue(response);
  }

  /**
   * HTTP POST
   */
  private async post(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 2) {
      return ValueFactory.err(ValueFactory.string('http.post requires URL and body'));
    }

    const url = params[0];
    const body = params[1];

    if (!ValueTypeChecker.isString(url)) {
      return ValueFactory.err(ValueFactory.string('URL must be a string'));
    }

    // Mock HTTP POST
    const response = this.mockPost(url.value, body);

    return this.responseToValue(response);
  }

  /**
   * HTTP PUT
   */
  private async put(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 2) {
      return ValueFactory.err(ValueFactory.string('http.put requires URL and body'));
    }

    const url = params[0];
    const body = params[1];

    if (!ValueTypeChecker.isString(url)) {
      return ValueFactory.err(ValueFactory.string('URL must be a string'));
    }

    // Mock HTTP PUT
    const response = this.mockPut(url.value, body);

    return this.responseToValue(response);
  }

  /**
   * HTTP DELETE
   */
  private async delete(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 1) {
      return ValueFactory.err(ValueFactory.string('http.delete requires a URL'));
    }

    const url = params[0];

    if (!ValueTypeChecker.isString(url)) {
      return ValueFactory.err(ValueFactory.string('URL must be a string'));
    }

    // Mock HTTP DELETE
    const response = this.mockDelete(url.value);

    return this.responseToValue(response);
  }

  /**
   * Generic HTTP call
   */
  private async call(params: Value[], principal: Principal): Promise<Value> {
    if (params.length < 2) {
      return ValueFactory.err(ValueFactory.string('http.call requires method and URL'));
    }

    const method = params[0];
    const url = params[1];

    if (!ValueTypeChecker.isString(method)) {
      return ValueFactory.err(ValueFactory.string('Method must be a string'));
    }

    if (!ValueTypeChecker.isString(url)) {
      return ValueFactory.err(ValueFactory.string('URL must be a string'));
    }

    // Mock HTTP call
    const response: HttpResponse = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"success": true}',
    };

    return this.responseToValue(response);
  }

  /**
   * Mock HTTP GET
   */
  private mockGet(url: string): HttpResponse {
    const mock = this.mockResponses.get(`GET:${url}`);
    if (mock) {
      return mock;
    }

    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, method: 'GET' }),
    };
  }

  /**
   * Mock HTTP POST
   */
  private mockPost(url: string, body: Value): HttpResponse {
    const mock = this.mockResponses.get(`POST:${url}`);
    if (mock) {
      return mock;
    }

    return {
      status: 201,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, method: 'POST', created: true }),
    };
  }

  /**
   * Mock HTTP PUT
   */
  private mockPut(url: string, body: Value): HttpResponse {
    const mock = this.mockResponses.get(`PUT:${url}`);
    if (mock) {
      return mock;
    }

    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, method: 'PUT', updated: true }),
    };
  }

  /**
   * Mock HTTP DELETE
   */
  private mockDelete(url: string): HttpResponse {
    const mock = this.mockResponses.get(`DELETE:${url}`);
    if (mock) {
      return mock;
    }

    return {
      status: 204,
      headers: {},
      body: '',
    };
  }

  /**
   * Convert HTTP response to CORE value
   */
  private responseToValue(response: HttpResponse): Value {
    const fields = new Map<string, Value>();

    fields.set('status', ValueFactory.int(response.status));
    fields.set('body', ValueFactory.string(response.body));

    // Convert headers to map
    const headersMap = new Map<string, Value>();
    for (const [key, value] of Object.entries(response.headers)) {
      headersMap.set(key, ValueFactory.string(value));
    }
    fields.set('headers', ValueFactory.map(headersMap));

    return ValueFactory.ok(ValueFactory.record('HttpResponse', fields));
  }

  /**
   * Set mock response (for testing)
   */
  setMockResponse(method: string, url: string, response: HttpResponse): void {
    this.mockResponses.set(`${method}:${url}`, response);
  }

  /**
   * Clear mock responses (for testing)
   */
  clearMocks(): void {
    this.mockResponses.clear();
  }
}
