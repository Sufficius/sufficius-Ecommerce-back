// src/types/passport.d.ts
declare module 'passport' {
  import { Strategy as PassportStrategy } from 'passport-strategy';
  
  interface AuthenticateOptions {
    session?: boolean;
    [key: string]: any;
  }

  interface PassportStatic {
    use(strategy: PassportStrategy): this;
    use(name: string, strategy: PassportStrategy): this;
    authenticate(strategy: string | string[], options?: AuthenticateOptions): any;
    initialize(options?: { userProperty?: string }): any;
    session(options?: { pauseStream?: boolean }): any;
  }

  const passport: PassportStatic;
  export = passport;
}

declare module 'passport-jwt' {
  import { Strategy as PassportStrategy } from 'passport-strategy';
  import { Request } from 'express';

  interface StrategyOptions {
    secretOrKey?: string | Buffer;
    secretOrKeyProvider?: (request: Request, rawJwtToken: any, done: (err: any, secretOrKey?: string | Buffer) => void) => void;
    jwtFromRequest: (req: Request) => string | null;
    issuer?: string;
    audience?: string;
    algorithms?: string[];
    ignoreExpiration?: boolean;
    passReqToCallback?: boolean;
    jsonWebTokenOptions?: any;
  }

  class Strategy extends PassportStrategy {
    constructor(opt: StrategyOptions, verify: any);
  }

  namespace ExtractJwt {
    function fromHeader(header_name: string): (req: Request) => string | null;
    function fromBodyField(field_name: string): (req: Request) => string | null;
    function fromUrlQueryParameter(param_name: string): (req: Request) => string | null;
    function fromAuthHeaderWithScheme(auth_scheme: string): (req: Request) => string | null;
    function fromAuthHeaderAsBearerToken(): (req: Request) => string | null;
    function fromExtractors(extractors: Array<(req: Request) => string | null>): (req: Request) => string | null;
  }

  export { Strategy, ExtractJwt, StrategyOptions };
}